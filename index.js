const { createApp } = Vue
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const API_BASE_URL = window.location.port === '3002'
  ? '/api'
  : isLocalHost
    ? 'http://127.0.0.1:3002/api'
    : 'https://school-project-backend-xlih.onrender.com/api'

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
    async checkout() {
      this.errorMessage = ''
      this.checkingOut = true

      try {
        const order = await this.request(`/api/checkout/${encodeURIComponent(this.cartId)}`, {
          method: 'POST',
          body: JSON.stringify({ userName: this.userName })
        })
        this.lastOrder = order
        this.cartItems = []
        order.lessons.forEach((bookedLesson) => {
          const lesson = this.lessons.find((item) => item.id === bookedLesson.id)
          if (lesson) lesson.availableSeats = bookedLesson.remainingSeats
        })
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
