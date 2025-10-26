// Product Tour + Mobile Menu
(function () {
  // ===== MOBILE MENU =====
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
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href')
      if (!href || href === '#') return
      const tgt = document.querySelector(href)
      if (!tgt) return
      e.preventDefault()
      tgt.scrollIntoView({ behavior: 'smooth', block: 'start' })

      // Close mobile menu if open
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden')
        menuIcon?.classList.remove('hidden')
        closeIcon?.classList.add('hidden')
      }
    })
  })
})()