// Partial loader, Product Tour + Mobile Menu
(function () {
  // ===== PARTIAL LOADER =====
  async function loadPartials() {
    const headerPlaceholder = document.getElementById('header-placeholder')
    const footerPlaceholder = document.getElementById('footer-placeholder')

    try {
      // Determine correct path based on current location
      const isInPagesFolder = window.location.pathname.includes('/pages/')
      const basePath = isInPagesFolder ? '../partials/' : './partials/'

      if (headerPlaceholder) {
        const headerResponse = await fetch(basePath + 'header.html')
        if (headerResponse.ok) {
          headerPlaceholder.innerHTML = await headerResponse.text()
          // Re-initialize mobile menu after header is loaded
          initMobileMenu()
          // Fix paths for nav links & logo based on current location
          fixHeaderPaths()
        }
      }

      if (footerPlaceholder) {
        const footerResponse = await fetch(basePath + 'footer.html')
        if (footerResponse.ok) {
          footerPlaceholder.innerHTML = await footerResponse.text()
        }
      }
    } catch (error) {
      console.error('Error loading partials:', error)
    }
  }

  // ===== HEADER PATH REWRITER =====
  function fixHeaderPaths() {
    const isInPagesFolder = window.location.pathname.includes('/pages/')
    const prefix = isInPagesFolder ? '../' : './'

    // Brand link -> Home
    const brand = document.querySelector('header .brand-link')
    if (brand) brand.setAttribute('href', prefix + 'pages/home.html')

    // Logo image
    const logo = document.querySelector('header img[data-src]')
    if (logo) logo.setAttribute('src', prefix + logo.getAttribute('data-src'))

    // Nav links (desktop + mobile)
    const routes = {
      home: 'pages/home.html',
      help: 'pages/help.html',
      updates: 'pages/updates.html'
    }
    document.querySelectorAll('header a.nav-link[data-page]').forEach((a) => {
      const key = a.getAttribute('data-page')
      if (key && routes[key]) {
        a.setAttribute('href', prefix + routes[key])
      }
    })
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

  // ===== PRODUCT TOUR SCROLL =====
  const tourSteps = Array.from(document.querySelectorAll('.tour-step'))
  const tourSlides = Array.from(document.querySelectorAll('.tour-slide'))

  if (tourSteps.length === 0 || tourSlides.length === 0) return

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
})()