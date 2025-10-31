// Partial loader, Product Tour + Mobile Menu
(function () {
  // ===== PARTIAL LOADER =====
  async function loadPartials() {
    const headerPlaceholder = document.getElementById('header-placeholder')
    const footerPlaceholder = document.getElementById('footer-placeholder')

    try {
      // Use root-absolute paths for partials to work from any page
      if (headerPlaceholder) {
        const headerResponse = await fetch('../partials/header.html')
        if (headerResponse.ok) {
          headerPlaceholder.innerHTML = await headerResponse.text()
          // Re-initialize mobile menu after header is loaded
          initMobileMenu()
          // Update download buttons inside header if possible
          updateDownloadLinks()
        }
      }

      if (footerPlaceholder) {
        const footerResponse = await fetch('../partials/footer.html')
        if (footerResponse.ok) {
          footerPlaceholder.innerHTML = await footerResponse.text()
        }
      }
    } catch (error) {
      console.error('Error loading partials:', error)
    }
  }

  // ===== MOBILE MENU =====
  function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn')
    const mobileMenu = document.getElementById('mobile-menu')
    const menuIcon = mobileMenuBtn?.querySelector('.menu-icon')
    const closeIcon = mobileMenuBtn?.querySelector('.close-icon')

    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = !mobileMenu.classList.contains('hidden')
        if (isOpen) {
          mobileMenu.classList.add('hidden')
          menuIcon?.classList.remove('hidden')
          closeIcon?.classList.add('hidden')
        } else {
          mobileMenu.classList.remove('hidden')
          menuIcon?.classList.add('hidden')
          closeIcon?.classList.remove('hidden')
        }
      })

      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.add('hidden')
          menuIcon?.classList.remove('hidden')
          closeIcon?.classList.add('hidden')
        })
      })

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
          mobileMenu.classList.add('hidden')
          menuIcon?.classList.remove('hidden')
          closeIcon?.classList.add('hidden')
        }
      })
    }
  }

  // Load partials on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPartials)
  } else {
    loadPartials()
  }

  // ===== DYNAMIC LATEST DOWNLOAD LINK =====
  async function updateDownloadLinks() {
    const targets = document.querySelectorAll('[data-download-latest]')
    if (targets.length === 0) return
    try {
      const resp = await fetch('https://api.github.com/repos/ARm8-2/refleks/releases/latest', {
        headers: { 'Accept': 'application/vnd.github+json' }
      })
      if (!resp.ok) return
      const data = await resp.json()
      const assets = Array.isArray(data.assets) ? data.assets : []
      const match = assets.find(a => /refleks-.*-windows-amd64-installer\.exe$/i.test(a?.name || ''))

      // Prefer the asset URL; otherwise construct from the tag name
      const rawTag = String(data?.tag_name || '').trim()
      const version = rawTag.replace(/^v/i, '')
      const assetName = version ? `refleks-${version}-windows-amd64-installer.exe` : ''
      const url = (match && match.browser_download_url) || (version ? `https://github.com/ARm8-2/refleks/releases/download/${version}/${assetName}` : '')
      if (!url) return

      targets.forEach(a => {
        a.setAttribute('href', url)
        // Same-tab, no extra tab flash
        a.removeAttribute('target')
        a.removeAttribute('rel')
        // Hint download; some browsers may ignore cross-origin
        a.setAttribute('download', assetName || '')
      })
    } catch (e) {
      // Silently ignore; anchors fall back to their default hrefs
      console.debug('Could not fetch latest release asset:', e)
    }
  }

  // Try to update any download buttons present on the page immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDownloadLinks)
  } else {
    updateDownloadLinks()
  }

  // ===== PRODUCT TOUR SCROLL =====
  const tourSteps = Array.from(document.querySelectorAll('.tour-step'))
  const tourSlides = Array.from(document.querySelectorAll('.tour-slide'))

  // Only initialize the product tour logic when both steps and slides exist on the page.
  if (tourSteps.length > 0 && tourSlides.length > 0) {
    let currentSlide = 1
    let ticking = false

    function activateSlide(slideNumber) {
      if (slideNumber === currentSlide) return
      currentSlide = slideNumber

      tourSlides.forEach(slide => {
        if (parseInt(slide.dataset.slide) === slideNumber) {
          slide.classList.add('active')
        } else {
          slide.classList.remove('active')
        }
      })
    }

    function updateTour() {
      if (ticking) return
      ticking = true

      requestAnimationFrame(() => {
        ticking = false

        const isDesktop = window.matchMedia('(min-width: 1024px)').matches
        if (!isDesktop) {
          // On mobile, all steps visible when in viewport
          tourSteps.forEach(step => {
            const rect = step.getBoundingClientRect()
            const vh = window.innerHeight
            if (rect.top < vh * 0.8 && rect.bottom > vh * 0.2) {
              step.classList.add('visible')
            } else {
              step.classList.remove('visible')
            }
          })
          return
        }

        const vh = window.innerHeight

        // Find which step should be active based on scroll position
        let activeStep = 1

        for (let i = 0; i < tourSteps.length; i++) {
          const step = tourSteps[i]
          const rect = step.getBoundingClientRect()
          const stepNum = parseInt(step.dataset.step)

          const activationPoint = vh * (stepNum / (tourSteps.length + 1)) * 0.9

          // When step enters activation point and hasn't left viewport, activate it
          if (rect.top < activationPoint && rect.bottom > 0) {
            activeStep = stepNum
          }
        }

        activateSlide(activeStep)

        // Only highlight the active step, dim all others
        tourSteps.forEach(step => {
          const stepNum = parseInt(step.dataset.step)
          if (stepNum === activeStep) {
            step.classList.add('visible')
          } else {
            step.classList.remove('visible')
          }
        })
      })
    }

    // Initial setup
    updateTour()

    // Update on scroll and resize
    window.addEventListener('scroll', updateTour, { passive: true })
    window.addEventListener('resize', updateTour)
  }

  // ===== SMOOTH ANCHOR SCROLL =====
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href')
        if (!href || href === '#') return
        const tgt = document.querySelector(href)
        if (!tgt) return
        e.preventDefault()
        tgt.scrollIntoView({ behavior: 'smooth', block: 'start' })

        // Close mobile menu if open
        const mobileMenu = document.getElementById('mobile-menu')
        const menuIcon = document.getElementById('mobile-menu-btn')?.querySelector('.menu-icon')
        const closeIcon = document.getElementById('mobile-menu-btn')?.querySelector('.close-icon')

        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
          mobileMenu.classList.add('hidden')
          menuIcon?.classList.remove('hidden')
          closeIcon?.classList.add('hidden')
        }
      })
    })
  }

  // Initialize smooth scroll on load and after partials load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmoothScroll)
  } else {
    initSmoothScroll()
  }

  // ===== PREVIEW DROPDOWN (Updates page) =====
  function initPreviewDropdown() {
    function setupPreviewToggle(toggleId, panelId) {
      const btn = document.getElementById(toggleId)
      const panel = document.getElementById(panelId)
      if (!btn || !panel) return
      btn.addEventListener('click', () => {
        const isHidden = panel.classList.toggle('hidden')
        const expanded = !isHidden
        btn.setAttribute('aria-expanded', String(expanded))
        const base = 'What are preview features '
        btn.textContent = base + (expanded ? '▴' : '▾')
      })
    }
    setupPreviewToggle('preview-toggle-1', 'preview-text-1')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreviewDropdown)
  } else {
    initPreviewDropdown()
  }
})()