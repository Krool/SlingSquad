import Phaser from 'phaser';

/**
 * Reusable scrollable panel with geometry mask, mouse wheel, touch drag,
 * and a thin scrollbar indicator.
 */
export class ScrollablePanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private scrollbar: Phaser.GameObjects.Graphics;
  private hitZone: Phaser.GameObjects.Rectangle;
  private viewportX: number;
  private viewportY: number;
  private viewportW: number;
  private viewportH: number;
  private contentH = 0;
  private scrollY = 0;

  // Touch drag state
  private dragging = false;
  private dragStartY = 0;
  private dragScrollStart = 0;
  private dragThreshold = 8;
  private dragStartPointerY = 0;

  // Bound event handlers for cleanup
  private onWheel: (e: WheelEvent) => void;
  private onPointerDown: (p: Phaser.Input.Pointer) => void;
  private onPointerMove: (p: Phaser.Input.Pointer) => void;
  private onPointerUp: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number, w: number, h: number,
    depth = 5,
  ) {
    this.scene = scene;
    this.viewportX = x;
    this.viewportY = y;
    this.viewportW = w;
    this.viewportH = h;

    // Content container
    this.container = scene.add.container(x, y).setDepth(depth);

    // Geometry mask
    this.maskShape = scene.add.graphics().setVisible(false);
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(x, y, w, h);
    const mask = new Phaser.Display.Masks.GeometryMask(scene, this.maskShape);
    this.container.setMask(mask);

    // Scrollbar indicator
    this.scrollbar = scene.add.graphics().setDepth(depth + 1);

    // Hit zone for scroll interactions
    this.hitZone = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
      .setInteractive().setDepth(depth - 1);

    // Mouse wheel
    this.onWheel = (e: WheelEvent) => {
      // Only scroll if pointer is inside viewport
      const pointer = scene.input.activePointer;
      if (pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h) {
        this.scrollBy(e.deltaY * 0.5);
        e.preventDefault();
      }
    };
    scene.game.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    // Touch / mouse drag
    this.onPointerDown = (p: Phaser.Input.Pointer) => {
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
        this.dragging = false;
        this.dragStartPointerY = p.y;
        this.dragStartY = p.y;
        this.dragScrollStart = this.scrollY;
      }
    };
    this.onPointerMove = (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (this.dragStartPointerY === 0) return;
      const dy = p.y - this.dragStartPointerY;
      if (!this.dragging && Math.abs(dy) > this.dragThreshold) {
        this.dragging = true;
        this.dragStartY = p.y;
        this.dragScrollStart = this.scrollY;
      }
      if (this.dragging) {
        const newScroll = this.dragScrollStart - (p.y - this.dragStartY);
        this.setScrollY(newScroll);
      }
    };
    this.onPointerUp = () => {
      this.dragging = false;
      this.dragStartPointerY = 0;
    };
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
  }

  /** Returns the container — add children into this. Children are positioned relative to (0,0) = top of scroll area. */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Set the total content height (must be called after adding children). */
  setContentHeight(h: number) {
    this.contentH = h;
    this.setScrollY(this.scrollY); // reclamp
    this.drawScrollbar();
  }

  /** Scroll by a delta (positive = scroll down). */
  scrollBy(delta: number) {
    this.setScrollY(this.scrollY + delta);
  }

  /** Set absolute scroll position, clamped. */
  private setScrollY(y: number) {
    const maxScroll = Math.max(0, this.contentH - this.viewportH);
    this.scrollY = Phaser.Math.Clamp(y, 0, maxScroll);
    this.container.y = this.viewportY - this.scrollY;
    this.drawScrollbar();
  }

  private drawScrollbar() {
    this.scrollbar.clear();
    if (this.contentH <= this.viewportH) return; // no scrollbar needed

    const barW = 4;
    const barX = this.viewportX + this.viewportW - barW - 2;
    const ratio = this.viewportH / this.contentH;
    const barH = Math.max(20, this.viewportH * ratio);
    const maxScroll = this.contentH - this.viewportH;
    const scrollPct = maxScroll > 0 ? this.scrollY / maxScroll : 0;
    const barY = this.viewportY + scrollPct * (this.viewportH - barH);

    this.scrollbar.fillStyle(0xffffff, 0.2);
    this.scrollbar.fillRoundedRect(barX, barY, barW, barH, 2);
  }

  /** Clean up listeners and destroy children. */
  destroy() {
    this.scene.game.canvas.removeEventListener('wheel', this.onWheel);
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointermove', this.onPointerMove);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.hitZone.destroy();
    this.container.destroy(true);
    this.maskShape.destroy();
    this.scrollbar.destroy();
  }
}
