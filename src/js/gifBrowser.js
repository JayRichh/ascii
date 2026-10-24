export class GifBrowser {
  constructor() {
    this.currentPage = 1
    this.itemsPerPage = 8
    this.currentCategory = "trending"
    this.gifs = []
    
    this.elements = {
      browser: document.getElementById("gif-browser"),
      grid: document.getElementById("gif-grid"),
      categorySelect: document.getElementById("category-select"),
      prevButton: document.getElementById("prev-page"),
      nextButton: document.getElementById("next-page"),
      pageInfo: document.getElementById("page-info"),
      browseToggle: document.getElementById("browse-toggle"),
      closeButton: document.getElementById("close-browser"),
      overlay: document.querySelector(".browser-overlay")
    }
    
    this.setupEventListeners()
    this.loadGifs()
  }
  
  setupEventListeners() {
    const { categorySelect, prevButton, nextButton, browseToggle, closeButton, overlay } = this.elements
    
    categorySelect.addEventListener("change", () => {
      this.currentCategory = categorySelect.value
      this.currentPage = 1
      this.loadGifs()
    })
    
    prevButton.addEventListener("click", () => {
      if (this.currentPage > 1) {
        this.currentPage--
        this.loadGifs()
      }
    })
    
    nextButton.addEventListener("click", () => {
      this.currentPage++
      this.loadGifs()
    })

    browseToggle.addEventListener("click", () => {
      const isOpen = !this.elements.browser.classList.contains("hidden")
      this.toggleBrowser(!isOpen)
    })

    closeButton.addEventListener("click", () => this.toggleBrowser(false))
    overlay.addEventListener("click", () => this.toggleBrowser(false))
    
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.elements.browser.classList.contains("hidden")) {
        this.toggleBrowser(false)
      }
    })
  }

  toggleBrowser(show) {
    const { browser, browseToggle } = this.elements
    browser.classList.toggle("hidden", !show)
    browseToggle.setAttribute("aria-pressed", show)
    
    if (show && this.gifs.length === 0) {
      this.loadGifs()
    }
  }
  
  async loadGifs() {
    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage
      const endpoint = this.buildEndpoint(offset)
      
      const response = await fetch(endpoint)
      const data = await response.json()
      
      if (data.meta.status !== 200) {
        throw new Error(data.meta.msg)
      }
      
      this.gifs = data.data
      this.renderGifs()
      this.updatePagination(data.pagination)
    } catch (error) {
      console.error("Error loading GIFs:", error)
      this.elements.grid.innerHTML = '<div class="error-message">Error loading GIFs. Please try again later.</div>'
    }
  }

  buildEndpoint(offset) {
    const GIPHY_API_KEY = '__GIPHY_API_KEY__'.replace(/^__.*__$/, '') // replaced by build.mjs
    if (!GIPHY_API_KEY) {
      throw new Error('GIPHY_API_KEY was not set at build time')
    }
    const baseUrl = "https://api.giphy.com/v1/gifs"
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit: this.itemsPerPage,
      offset,
      rating: 'g'
    })

    return this.currentCategory === "trending"
      ? `${baseUrl}/trending?${params}`
      : `${baseUrl}/search?${params}&q=${this.currentCategory}`
  }
  
  renderGifs() {
    const { grid } = this.elements
    grid.innerHTML = Array(this.itemsPerPage)
      .fill('<div class="gif-item loading"><div class="skeleton-pulse"></div></div>')
      .join('')
    
    this.gifs.forEach((gif, index) => this.loadGifImages(gif, index))
  }

  async loadGifImages(gif, index) {
    const loadImage = url => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    }

    try {
      const [thumbnail, preview] = await Promise.all([
        loadImage(gif.images.fixed_width_small.url),
        loadImage(gif.images.fixed_height.url)
      ])

      const item = this.createGifItem(gif, thumbnail, preview)
      const skeletons = this.elements.grid.querySelectorAll('.gif-item.loading')
      
      if (skeletons[index]) {
        skeletons[index].replaceWith(item)
      } else {
        this.elements.grid.appendChild(item)
      }
    } catch {
      const skeletons = this.elements.grid.querySelectorAll('.gif-item.loading')
      if (skeletons[index]) skeletons[index].remove()
    }
  }

  createGifItem(gif, thumbnail, preview) {
    const item = document.createElement("div")
    item.className = "gif-item"
    
    thumbnail.alt = gif.title
    item.appendChild(thumbnail)
    
    const previewContainer = document.createElement("div")
    previewContainer.className = "gif-preview"
    preview.alt = gif.title
    previewContainer.appendChild(preview)
    item.appendChild(previewContainer)
    
    item.addEventListener("click", () => {
      document.getElementById("gif-url").value = gif.images.original.url
      document.getElementById("go-button").click()
      this.toggleBrowser(false)
    })
    
    return item
  }

  updatePagination(pagination) {
    const { pageInfo, prevButton, nextButton } = this.elements
    pageInfo.textContent = `Page ${this.currentPage}`
    prevButton.disabled = this.currentPage === 1
    nextButton.disabled = (this.currentPage * this.itemsPerPage) >= pagination.total_count
  }
}
