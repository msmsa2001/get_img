import { Component, ElementRef, ViewChild } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'; // Using legacy build

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild('pdfCanvas', { static: false }) pdfCanvas!: ElementRef<HTMLCanvasElement>;
  private pdfDoc: any;
  private currentPage: number = 1; // Current page number
  private totalPages: number = 0; // Total pages in the PDF
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private cropStartX: number = 0;
  private cropStartY: number = 0;
  private cropWidth: number = 0;
  private cropHeight: number = 0;
  private isSelecting: boolean = false;

  constructor() {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d')!;
  }

  // Handle PDF file upload and rendering
  async loadPdf(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
        // Load the PDF document
        const pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
        this.pdfDoc = pdfDoc;
        this.totalPages = pdfDoc.numPages;
        this.renderPage(this.currentPage); // Render the first page
      };
      fileReader.readAsArrayBuffer(file);
    }
  }

  // Render a specific page of the PDF
  async renderPage(pageNumber: number) {
    if (pageNumber < 1 || pageNumber > this.totalPages) {
      return;
    }

    this.currentPage = pageNumber; // Update current page
    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });

    this.canvas.height = viewport.height;
    this.canvas.width = viewport.width;

    const renderContext = {
      canvasContext: this.context,
      viewport: viewport
    };

    // Render the page onto the canvas
    await page.render(renderContext).promise;
    this.displayCanvas();
  }

  // Display the rendered canvas on the DOM
  displayCanvas() {
    const canvasElement = this.pdfCanvas.nativeElement;
    const ctx = canvasElement.getContext('2d')!;
    canvasElement.width = this.canvas.width;
    canvasElement.height = this.canvas.height;
    ctx.drawImage(this.canvas, 0, 0);
  }

  // Go to the previous page
  goToPreviousPage() {
    if (this.currentPage > 1) {
      this.renderPage(this.currentPage - 1);
    }
  }

  // Go to the next page
  goToNextPage() {
    if (this.currentPage < this.totalPages) {
      this.renderPage(this.currentPage + 1);
    }
  }

  // Start cropping
  startCrop(event: MouseEvent) {
    this.isSelecting = true;
    this.cropStartX = event.offsetX;
    this.cropStartY = event.offsetY;
    this.cropWidth = 0;
    this.cropHeight = 0;
  }

  // Handle mouse move for cropping
  onMouseMove(event: MouseEvent) {
    if (this.isSelecting) {
      this.cropWidth = event.offsetX - this.cropStartX;
      this.cropHeight = event.offsetY - this.cropStartY;

      // Redraw the canvas and selection box
      this.redrawCanvas();
      this.drawSelectionArea();
    }
  }

  // End cropping
  endCrop() {
    if (this.cropWidth === 0 || this.cropHeight === 0) {
      this.isSelecting = false;
      return;
    }

    this.isSelecting = false;
    this.cropImage();
  }

  // Redraw the canvas and apply the crop selection
  redrawCanvas() {
    const canvasElement = this.pdfCanvas.nativeElement;
    const ctx = canvasElement.getContext('2d')!;
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.drawImage(this.canvas, 0, 0);
  }

  // Draw the selection box for cropping
  drawSelectionArea() {
    const canvasElement = this.pdfCanvas.nativeElement;
    const ctx = canvasElement.getContext('2d')!;
    ctx.beginPath();
    ctx.rect(this.cropStartX, this.cropStartY, this.cropWidth, this.cropHeight);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Crop the selected area from the PDF
  cropImage() {
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d')!;
    croppedCanvas.width = Math.abs(this.cropWidth);  // Ensure positive width
    croppedCanvas.height = Math.abs(this.cropHeight); // Ensure positive height

    const canvasElement = this.pdfCanvas.nativeElement;
    const ctx = canvasElement.getContext('2d')!;

    // Ensure the crop area is valid (check for non-zero width/height)
    if (this.cropWidth <= 0 || this.cropHeight <= 0) {
      console.error('Invalid crop area');
      return;
    }

    // Get the image data for the selected crop area
    const imageData = ctx.getImageData(this.cropStartX, this.cropStartY, this.cropWidth, this.cropHeight);
    croppedCtx.putImageData(imageData, 0, 0);

    // Display the cropped image and offer a download option
    const croppedDataUrl = croppedCanvas.toDataURL();
    this.displayCroppedImage(croppedDataUrl);
  }

  // Display the cropped image and provide a download link
  displayCroppedImage(dataUrl: string) {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const croppedCanvas = document.createElement('canvas');
      const ctx = croppedCanvas.getContext('2d')!;
      croppedCanvas.width = img.width;
      croppedCanvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Append the cropped image to the DOM
      document.body.appendChild(croppedCanvas);

      // Provide a download link for the cropped image
      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = 'cropped_image.png';
      downloadLink.innerText = 'Download Cropped Image';
      document.body.appendChild(downloadLink);
    };
  }
}
