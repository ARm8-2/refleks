//go:build windows

package mouse

import (
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"refleks/internal/constants"
	"refleks/internal/models"
)

// Windows raw input-based mouse tracker.
// Creates a hidden message window, registers for raw mouse input (RIDEV_INPUTSINK),
// processes WM_INPUT via GetRawInputData, and accumulates relative deltas into an
// unbounded virtual coordinate space not clipped to the screen.

type trackerWin struct {
	mu      sync.RWMutex
	running bool
	buf     []models.MousePoint
	bufDur  time.Duration

	// window thread state
	doneCh   chan struct{}
	threadID uint32
	hwnd     uintptr
	atom     uint16

	// accumulation
	vx int32
	vy int32
}

// New returns a new Windows mouse tracker using Raw Input.
func New(sampleHz int) Provider { // sampleHz unused for raw input
	return &trackerWin{
		bufDur: time.Duration(constants.DefaultMouseBufferMinutes) * time.Minute,
		doneCh: make(chan struct{}),
	}
}

func (t *trackerWin) Start() error {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return nil
	}
	t.running = true
	t.doneCh = make(chan struct{})
	t.mu.Unlock()

	go t.winLoop()
	return nil
}

func (t *trackerWin) Stop() {
	t.mu.Lock()
	if !t.running {
		t.mu.Unlock()
		return
	}
	done := t.doneCh
	tid := t.threadID
	t.running = false
	t.mu.Unlock()

	if tid != 0 {
		procPostThreadMessageW.Call(uintptr(tid), WM_QUIT, 0, 0)
	}
	select {
	case <-done:
	case <-time.After(1 * time.Second):
	}
}

func (t *trackerWin) SetBufferDuration(d time.Duration) {
	t.mu.Lock()
	t.bufDur = d
	// prune immediately
	now := time.Now()
	cutoff := now.Add(-d)
	i := 0
	for i < len(t.buf) && t.buf[i].TS.Before(cutoff) {
		i++
	}
	if i > 0 {
		t.buf = append([]models.MousePoint(nil), t.buf[i:]...)
	}
	t.mu.Unlock()
}

func (t *trackerWin) Enabled() bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.running
}

func (t *trackerWin) GetRange(start, end time.Time) []models.MousePoint {
	t.mu.RLock()
	defer t.mu.RUnlock()
	if len(t.buf) == 0 {
		return nil
	}
	out := make([]models.MousePoint, 0, 256)
	for _, p := range t.buf {
		if p.TS.Before(start) {
			continue
		}
		if p.TS.After(end) {
			break
		}
		out = append(out, p)
	}
	return out
}

// --- Windows interop ---

var (
	user32                   = syscall.NewLazyDLL("user32.dll")
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	procRegisterClassExW     = user32.NewProc("RegisterClassExW")
	procUnregisterClassW     = user32.NewProc("UnregisterClassW")
	procCreateWindowExW      = user32.NewProc("CreateWindowExW")
	procDestroyWindow        = user32.NewProc("DestroyWindow")
	procDefWindowProcW       = user32.NewProc("DefWindowProcW")
	procGetMessageW          = user32.NewProc("GetMessageW")
	procTranslateMessage     = user32.NewProc("TranslateMessage")
	procDispatchMessageW     = user32.NewProc("DispatchMessageW")
	procPostThreadMessageW   = user32.NewProc("PostThreadMessageW")
	procGetCurrentThreadId   = kernel32.NewProc("GetCurrentThreadId")
	procGetModuleHandleW     = kernel32.NewProc("GetModuleHandleW")
	procRegisterRawInputDevs = user32.NewProc("RegisterRawInputDevices")
	procGetRawInputData      = user32.NewProc("GetRawInputData")
)

const (
	WM_INPUT = 0x00FF
	WM_QUIT  = 0x0012

	RID_INPUT     = 0x10000003
	RIM_TYPEMOUSE = 0

	RIDEV_REMOVE    = 0x00000001
	RIDEV_INPUTSINK = 0x00000100
)

type WNDCLASSEX struct {
	CbSize        uint32
	Style         uint32
	LpfnWndProc   uintptr
	CbClsExtra    int32
	CbWndExtra    int32
	HInstance     uintptr
	HIcon         uintptr
	HCursor       uintptr
	HbrBackground uintptr
	LpszMenuName  *uint16
	LpszClassName *uint16
	HIconSm       uintptr
}

type MSG struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      struct{ X, Y int32 }
}

type RAWINPUTDEVICE struct {
	UsUsagePage uint16
	UsUsage     uint16
	DwFlags     uint32
	HwndTarget  uintptr
}

type RAWINPUTHEADER struct {
	DwType  uint32
	DwSize  uint32
	HDevice uintptr
	WParam  uintptr
}

type RAWMOUSE struct {
	UsFlags            uint16
	UsButtonFlags      uint16
	UsButtonData       uint16
	UlRawButtons       uint32
	LLastX             int32
	LLastY             int32
	UlExtraInformation uint32
}

// Global tracker for window proc routing (single instance)
var currentTracker *trackerWin

func utf16PtrFromString(s string) *uint16 { return syscall.StringToUTF16Ptr(s) }

func (t *trackerWin) winLoop() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	// Register window class
	className := utf16PtrFromString("RefleksRawInputWindow")
	wndProc := syscall.NewCallback(wndProc)

	hInst, _, _ := procGetModuleHandleW.Call(0)
	wc := WNDCLASSEX{
		CbSize:        uint32(unsafe.Sizeof(WNDCLASSEX{})),
		LpfnWndProc:   wndProc,
		HInstance:     hInst,
		LpszClassName: className,
	}
	atom, _, _ := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
	if atom == 0 {
		// fail fast
		t.mu.Lock()
		close(t.doneCh)
		t.mu.Unlock()
		return
	}

	hwnd, _, _ := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(utf16PtrFromString("refleks_raw_input"))),
		0, // style (invisible)
		0, 0, 0, 0,
		0, 0, hInst, 0,
	)
	if hwnd == 0 {
		// cleanup class
		procUnregisterClassW.Call(uintptr(unsafe.Pointer(className)), hInst)
		t.mu.Lock()
		close(t.doneCh)
		t.mu.Unlock()
		return
	}

	// Register to receive raw mouse input in the background
	rid := RAWINPUTDEVICE{
		UsUsagePage: 0x01, // generic desktop controls
		UsUsage:     0x02, // mouse
		DwFlags:     RIDEV_INPUTSINK,
		HwndTarget:  hwnd,
	}
	if r, _, _ := procRegisterRawInputDevs.Call(
		uintptr(unsafe.Pointer(&rid)),
		1,
		unsafe.Sizeof(rid),
	); r == 0 {
		// destroy window, unregister class
		procDestroyWindow.Call(hwnd)
		procUnregisterClassW.Call(uintptr(unsafe.Pointer(className)), hInst)
		t.mu.Lock()
		close(t.doneCh)
		t.mu.Unlock()
		return
	}

	// Expose state
	tid, _, _ := procGetCurrentThreadId.Call()
	t.mu.Lock()
	t.threadID = uint32(tid)
	t.hwnd = hwnd
	t.atom = uint16(atom)
	currentTracker = t
	t.mu.Unlock()

	// Message loop
	var m MSG
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 { // WM_QUIT or error
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}

	// Cleanup registration and window
	// Unregister raw input
	ridRemove := RAWINPUTDEVICE{UsUsagePage: 0x01, UsUsage: 0x02, DwFlags: RIDEV_REMOVE, HwndTarget: 0}
	procRegisterRawInputDevs.Call(uintptr(unsafe.Pointer(&ridRemove)), 1, unsafe.Sizeof(ridRemove))

	if hwnd != 0 {
		procDestroyWindow.Call(hwnd)
	}
	if atom != 0 {
		procUnregisterClassW.Call(uintptr(unsafe.Pointer(className)), hInst)
	}

	t.mu.Lock()
	currentTracker = nil
	t.hwnd = 0
	t.threadID = 0
	close(t.doneCh)
	t.mu.Unlock()
}

// Window procedure to handle WM_INPUT
func wndProc(hwnd uintptr, msg uint32, wparam, lparam uintptr) uintptr {
	switch msg {
	case WM_INPUT:
		if currentTracker != nil {
			currentTracker.handleRawInput(lparam)
		}
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, uintptr(msg), wparam, lparam)
	return r
}

func (t *trackerWin) handleRawInput(lparam uintptr) {
	// Query required size
	var size uint32
	// First call with pData = nil to get size
	procGetRawInputData.Call(lparam, RID_INPUT, 0, uintptr(unsafe.Pointer(&size)), unsafe.Sizeof(RAWINPUTHEADER{}))
	if size == 0 || size > 4096 {
		return
	}
	buf := make([]byte, size)
	ret, _, _ := procGetRawInputData.Call(lparam, RID_INPUT, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)), unsafe.Sizeof(RAWINPUTHEADER{}))
	if ret == 0 {
		return
	}
	// Inspect header
	hdr := (*RAWINPUTHEADER)(unsafe.Pointer(&buf[0]))
	if hdr.DwType != RIM_TYPEMOUSE {
		return
	}
	// RAWMOUSE follows the header in the buffer
	mouse := (*RAWMOUSE)(unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0])) + uintptr(unsafe.Sizeof(RAWINPUTHEADER{}))))

	// Use relative motion deltas (unclipped)
	dx := mouse.LLastX
	dy := mouse.LLastY
	if dx == 0 && dy == 0 {
		return
	}
	now := time.Now()
	t.mu.Lock()
	t.vx += dx
	t.vy += dy
	t.buf = append(t.buf, models.MousePoint{TS: now, X: t.vx, Y: t.vy})
	// prune old samples
	cutoff := now.Add(-t.bufDur)
	i := 0
	for i < len(t.buf) && t.buf[i].TS.Before(cutoff) {
		i++
	}
	if i > 0 {
		t.buf = append([]models.MousePoint(nil), t.buf[i:]...)
	}
	t.mu.Unlock()
}
