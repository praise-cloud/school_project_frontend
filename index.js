const { createApp } = Vue
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_BASE_URL = window.location.port === '3002'
  ? '/api'
  : isLocalHost
    ? 'http://127.0.0.1:3002/api'
    : 'https://school-project-backend-1.onrender.com/api'

function getCartId() {
  let cartId = localStorage.getItem('aftaclass-cart-id')

  if (!cartId) {
    cartId = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('aftaclass-cart-id', cartId)
  }

  return cartId
}

createApp({
  data() {
    return {
      page: 'home',
      cartId: getCartId(),
      lessons: [],
      cartItems: [],
      searchQuery: '',
      selectedSubject: '',
      maxPrice: 100,
      sortBy: 'subject',
      sortDirection: 'asc',
      userName: '',
      userPhone: '',
      userEmail: '',
      lastOrder: { userName: '', lessons: [] },
      loading: true,
      checkingOut: false,
      errorMessage: ''
    }
  },
  computed: {
    subjects() {
      return [...new Set(this.lessons.map((lesson) => lesson.subject))]
    },
    filteredLessons() {
      const query = this.searchQuery.trim().toLowerCase()
      const direction = this.sortDirection === 'asc' ? 1 : -1

      return this.lessons.filter((lesson) => {
        const matchesSubject = !this.selectedSubject || lesson.subject === this.selectedSubject
        const matchesPrice = lesson.price <= this.maxPrice
        const searchableDetails =
          `${lesson.title} ${lesson.subject} ${lesson.location} ${lesson.description} ${lesson.instructor}`.toLowerCase()

        return matchesSubject && matchesPrice && (!query || searchableDetails.includes(query))
      }).sort((first, second) => {
        const firstValue = first[this.sortBy]
        const secondValue = second[this.sortBy]
        const comparison = this.sortBy === 'price' || this.sortBy === 'availableSeats'
          ? Number(firstValue) - Number(secondValue)
          : String(firstValue || '').localeCompare(String(secondValue || ''), undefined, {
            sensitivity: 'base'
          })

        return comparison * direction || first.id - second.id
      })
    },
    cartSeatCount() {
      return this.cartItems.reduce((total, lesson) => total + lesson.quantity, 0)
    },
    cartTotal() {
      return this.cartItems.reduce((total, lesson) => total + lesson.price * lesson.quantity, 0)
    },
    isCheckoutValid() {
      const isNameValid = /^[a-zA-Z\s]+$/.test(this.userName.trim())
      const isPhoneValid = /^\d+$/.test(this.userPhone.trim())
      const hasItems = this.cartItems.length > 0
      return isNameValid && isPhoneValid && hasItems
    }
  },
  async mounted() {
    await Promise.all([this.loadLessons(), this.loadCart()])
  },
  methods: {
    async request(url, options = {}) {
      const response = await fetch(`${API_BASE_URL}${url.replace(/^\/api/, '')}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'The request could not be completed.')
      }

      return result
    },
    async loadLessons() {
      this.loading = true
      this.errorMessage = ''
      try {
        this.lessons = await this.request('/api/lessons')
      } catch (error) {
        this.errorMessage = error.message
      } finally {
        this.loading = false
      }
    },
    async loadCart() {
      try {
        const result = await this.request(`/api/cart/${encodeURIComponent(this.cartId)}`)
        this.cartItems = result.items
      } catch (error) {
        this.errorMessage = error.message
      }
    },
    async addToCart(lessonId) {
      this.errorMessage = ''
      try {
        const result = await this.request(`/api/cart/${encodeURIComponent(this.cartId)}/items`, {
          method: 'POST',
          body: JSON.stringify({ lessonId })
        })
        this.cartItems = result.items
      } catch (error) {
        this.errorMessage = error.message
        await this.loadLessons()
      }
    },
    async removeFromCart(lessonId) {
      this.errorMessage = ''
      try {
        const result = await this.request(
          `/api/cart/${encodeURIComponent(this.cartId)}/items/${lessonId}`,
          { method: 'DELETE' }
        )
        this.cartItems = result.items
      } catch (error) {
        this.errorMessage = error.message
      }
    },
    async showCart() {
      this.errorMessage = ''
      await this.loadCart()
      this.page = 'cart'
    },
    onNameInput(e) {
      this.userName = e.target.value.replace(/[^a-zA-Z\s]/g, '')
    },
    onPhoneInput(e) {
      this.userPhone = e.target.value.replace(/\D/g, '')
    },
    onSearchInput() {
      clearTimeout(this.searchTimeout)
      this.searchTimeout = setTimeout(async () => {
        const query = this.searchQuery.trim()
        if (!query) {
          await this.loadLessons()
          return
        }
        this.loading = true
        try {
          this.lessons = await this.request(`/search?q=${encodeURIComponent(query)}`)
        } catch (err) {
          this.errorMessage = err.message
        } finally {
          this.loading = false
        }
      }, 300)
    },
    async checkout() {
      this.errorMessage = ''

      if (!this.userName.trim() || !/^[a-zA-Z\s]+$/.test(this.userName.trim())) {
        this.errorMessage = 'Name is required and must contain letters only.'
        return
      }

      if (!this.userPhone.trim() || !/^\d+$/.test(this.userPhone.trim())) {
        this.errorMessage = 'Phone number is required and must contain numbers only.'
        return
      }

      if (!this.cartItems.length) {
        this.errorMessage = 'Your cart is empty.'
        return
      }

      this.checkingOut = true

      try {
        // 1. POST fetch: Save new order to MongoDB 'orders' collection
        const order = await this.request('/orders', {
          method: 'POST',
          body: JSON.stringify({
            name: this.userName.trim(),
            phone: this.userPhone.trim(),
            email: this.userEmail.trim(),
            lessons: this.cartItems.map((l) => ({
              id: l.id,
              title: l.title,
              price: l.price,
              quantity: l.quantity
            })),
            space: this.cartSeatCount,
            totalPrice: this.cartTotal
          })
        })

        // 2. PUT fetch: Update available lesson spaces in MongoDB for each booked lesson
        for (const item of this.cartItems) {
          const newSpace = Math.max(item.availableSeats - item.quantity, 0)
          await this.request(`/lessons/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ availableSeats: newSpace })
          })
          const lesson = this.lessons.find((l) => l.id === item.id)
          if (lesson) lesson.availableSeats = newSpace
        }

        this.lastOrder = {
          userName: this.userName.trim(),
          lessons: this.cartItems.map((item) => ({
            ...item,
            remainingSeats: Math.max(item.availableSeats - item.quantity, 0)
          }))
        }

        // 3. Clear cart
        try {
          await this.request(`/api/checkout/${encodeURIComponent(this.cartId)}`, {
            method: 'POST',
            body: JSON.stringify({
              name: this.userName.trim(),
              phone: this.userPhone.trim(),
              email: this.userEmail.trim()
            })
          })
        } catch (e) {
          // In case in-memory cart was already synced
        }
        this.cartItems = []

        this.page = 'success'
      } catch (error) {
        this.errorMessage = error.message
        await Promise.all([this.loadCart(), this.loadLessons()])
      } finally {
        this.checkingOut = false
      }
    },
    isInCart(lessonId) {
      return this.cartItems.some((lesson) => lesson.id === lessonId)
    },
    remainingSeats(lesson) {
      const cartItem = this.cartItems.find((item) => item.id === lesson.id)
      return Math.max(lesson.availableSeats - (cartItem ? cartItem.quantity : 0), 0)
    },
    formatPrice(amount) {
      return new Intl.NumberFormat('en-MU', {
        style: 'currency',
        currency: 'MUR',
        maximumFractionDigits: 0
      }).format(amount)
    },
    async scrollToCourses() {
      if (this.page !== 'home') this.goHome()
      await Vue.nextTick()
      const courseSection = document.getElementById('course-section')
      if (courseSection) courseSection.scrollIntoView({ behavior: 'smooth' })
    },
    goHome() {
      this.errorMessage = ''
      this.page = 'home'
    }
  }
}).mount('#app')
