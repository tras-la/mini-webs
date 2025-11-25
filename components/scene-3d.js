customElements.define("scene-3d", class extends HTMLElement {
  constructor() {
    super();
    this.baseline = { beta: 0, gamma: 0 }; // neutral angles
  }

  connectedCallback() {
    // Wait a moment for the user to hold the phone naturally
    setTimeout(() => {
      window.addEventListener("deviceorientation", this.handleOrientation);
    }, 200);

    document.addEventListener("pointermove", (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;

        this.firstElementChild.style.transform = `rotateX(${y * -1}deg) rotateY(${x}deg)`;
      });
  }

  handleOrientation = (e) => {
    if (!this.firstElementChild) return;

    const { beta, gamma } = e;

    // If baseline is not set yet and angles look stable, capture
    if (this.baseline.beta === 0 && this.baseline.gamma === 0) {
      this.baseline = { beta, gamma };
      return;
    }

    // Subtract baseline → this is the magic
    const tiltX = gamma - this.baseline.gamma;
    const tiltY = beta - this.baseline.beta;

    // Limit exaggeration
    const x = Math.max(-20, Math.min(20, tiltX));
    const y = Math.max(-20, Math.min(20, tiltY));

    // Apply tilt
    this.firstElementChild.style.transform =
      `rotateY(${x * 0.5}deg) rotateX(${y * -0.5}deg)`;
  }
});