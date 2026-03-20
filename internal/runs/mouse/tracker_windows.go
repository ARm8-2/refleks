//go:build windows

package mouse

import (
	"runtime"
	"sync"
	"sync/atomic"
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
	// current button state bitmask (left/right/middle/etc.)
	buttons uint32
	// logical start index into buf for lazy pruning/compaction
	start int
	// reusable raw input buffer to avoid per-event allocations
	rawBuf []byte
	// ring buffer for raw events (SPSC)
	rb      []rawEvent
	rbMask  uint32
	rbWrite uint32 // producer index
	rbRead  uint32 // consumer index
	// wake signal when ring transitions from empty->non-empty (buffered, coalesced)
	wakeCh     chan struct{}
	workerDone chan struct{}
	// last time we pruned the buffer (rate-limit pruning)
	lastPrune time.Time
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
	// allocate ring buffer (power-of-two size for cheap masking)
	const rbSize = 1 << 14 // 16384 events
	t.rb = make([]rawEvent, rbSize)
	t.rbMask = uint32(rbSize - 1)
	atomic.StoreUint32(&t.rbWrite, 0)
	atomic.StoreUint32(&t.rbRead, 0)
	t.wakeCh = make(chan struct{}, 1)
	t.workerDone = make(chan struct{})
	t.lastPrune = time.Now()
	t.mu.Unlock()
	go t.eventLoop()
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
	// Window thread has exited; close wake channel to stop worker and wait
	if t.wakeCh != nil {
		close(t.wakeCh)
		select {
		case <-t.workerDone:
		case <-time.After(500 * time.Millisecond):
		}
		t.wakeCh = nil
	}
}

func (t *trackerWin) SetBufferDuration(d time.Duration) {
	t.mu.Lock()
	t.bufDur = d
	// prune immediately (lazy: update start index, compact only occasionally)
	now := time.Now()
	cutoff := now.Add(-d).UnixMilli()
	j := t.start
	for j < len(t.buf) && t.buf[j].TS < cutoff {
		j++
	}
	if j > t.start {
		t.start = j
		// Compact underlying slice only when start grows large to avoid frequent copies
		if t.start > 2048 {
			t.buf = append([]models.MousePoint(nil), t.buf[t.start:]...)
			t.start = 0
		}
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
	startMs := start.UnixMilli()
	endMs := end.UnixMilli()
	out := make([]models.MousePoint, 0, 256)
	for i := t.start; i < len(t.buf); i++ {
		p := t.buf[i]
		if p.TS < startMs {
			continue
		}
		if p.TS > endMs {
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

// Raw input mouse button flags (from WinUser.h)
const (
	RI_MOUSE_LEFT_BUTTON_DOWN = 0x0001
	RI_MOUSE_LEFT_BUTTON_UP   = 0x0002
)

// Local bitmask mapping for models.MousePoint.Buttons
const (
	mbLeft = 1 << 0
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
	// usFlags (USHORT)
	UsFlags uint16
	// union: ulButtons (ULONG) or { usButtonFlags (USHORT), usButtonData (USHORT) }
	UlButtons          uint32
	UlRawButtons       uint32
	LLastX             int32
	LLastY             int32
	UlExtraInformation uint32
}

// rawEvent is a lightweight representation of parsed raw input passed from
// the window thread to the background worker to do accumulation and buffering.
type rawEvent struct {
	dx    int32
	dy    int32
	flags uint16
	ts    time.Time
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
	// Reuse a buffer to avoid per-event allocations.
	if cap(t.rawBuf) < int(size) {
		t.rawBuf = make([]byte, size)
	}
	buf := t.rawBuf[:size]
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

	// Use relative motion deltas (unclipped) and button flags
	dx := mouse.LLastX
	dy := mouse.LLastY
	// The RAWMOUSE union places either ulButtons (32-bit) or two USHORTs for
	// usButtonFlags/usButtonData. Read the low WORD of UlButtons to get usButtonFlags.
	ulButtons := mouse.UlButtons
	flags := uint16(ulButtons & 0xFFFF)

	// Enqueue into ring buffer with lock-free SPSC semantics.
	write := atomic.LoadUint32(&t.rbWrite)
	read := atomic.LoadUint32(&t.rbRead)
	if uint32(len(t.rb))-(write-read) == 0 {
		// ring full -> drop event
		return
	}
	// Always signal wake to avoid race conditions where the worker sleeps
	// thinking the buffer is empty while we are writing to it.
	// The overhead of a non-blocking select is negligible compared to the risk of stalling.
	t.rb[write&t.rbMask] = rawEvent{dx: dx, dy: dy, flags: flags}
	atomic.StoreUint32(&t.rbWrite, write+1)
	if t.wakeCh != nil {
		select {
		case t.wakeCh <- struct{}{}:
		default:
		}
	}
}

// eventLoop consumes parsed raw input events and performs accumulation and
// buffering on a background goroutine so the window thread stays lightweight.
func (t *trackerWin) eventLoop() {
	defer func() {
		if t.workerDone != nil {
			close(t.workerDone)
		}
	}()
	for {
		// Drain all pending events
		for {
			read := atomic.LoadUint32(&t.rbRead)
			write := atomic.LoadUint32(&t.rbWrite)
			if read == write {
				break
			}
			ev := t.rb[read&t.rbMask]

			t.mu.Lock()
			changed := false
			if ev.dx != 0 || ev.dy != 0 {
				t.vx += ev.dx
				t.vy += ev.dy
				changed = true
			}
			// Only track left button changes
			if ev.flags&uint16(RI_MOUSE_LEFT_BUTTON_DOWN) != 0 {
				if t.buttons&mbLeft == 0 {
					t.buttons |= mbLeft
					changed = true
				}
			}
			if ev.flags&uint16(RI_MOUSE_LEFT_BUTTON_UP) != 0 {
				if t.buttons&mbLeft != 0 {
					t.buttons &^= mbLeft
					changed = true
				}
			}
			if changed {
				now := time.Now()
				t.buf = append(t.buf, models.MousePoint{TS: now.UnixMilli(), X: t.vx, Y: t.vy, Buttons: int32(t.buttons)})
				// prune occasionally
				if time.Since(t.lastPrune) > time.Second || (len(t.buf)-t.start) > 16384 {
					cutoff := now.Add(-t.bufDur).UnixMilli()
					j := t.start
					for j < len(t.buf) && t.buf[j].TS < cutoff {
						j++
					}
					if j > t.start {
						t.start = j
						if t.start > 2048 {
							t.buf = append([]models.MousePoint(nil), t.buf[t.start:]...)
							t.start = 0
						}
					}
					t.lastPrune = now
				}
			}
			t.mu.Unlock()

			atomic.StoreUint32(&t.rbRead, read+1)
		}
		// Wait until new events arrive or wake channel is closed
		if t.wakeCh == nil {
			return
		}
		if _, ok := <-t.wakeCh; !ok {
			return
		}
	}
}
