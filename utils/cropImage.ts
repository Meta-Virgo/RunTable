export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * This function was adapted from the one in the ReadMe of https://github.com/DominicTobias/react-image-crop
 */
export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  options: {
    outputWidth?: number;
    outputHeight?: number;
    mimeType?: string;
    quality?: number;
  } = {}
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  // calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  // set canvas size to match the bounding box
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  // croppedAreaPixels values are bounding box relative
  // extract the cropped image using these values
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // Use a temporary canvas to hold the cropped data
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = pixelCrop.width
  tempCanvas.height = pixelCrop.height
  const tempCtx = tempCanvas.getContext('2d')
  
  if (!tempCtx) {
    return null
  }
  
  tempCtx.putImageData(data, 0, 0)

  const outputWidth = options.outputWidth || 400
  const outputHeight = options.outputHeight || 400

  // Create final canvas for resizing and compression
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = outputWidth
  finalCanvas.height = outputHeight
  const finalCtx = finalCanvas.getContext('2d')
  
  if (!finalCtx) {
    return null
  }

  // Draw the temp canvas onto the final canvas with resizing
  // This uses the browser's image interpolation which is better than just dropping pixels
  finalCtx.drawImage(
    tempCanvas,
    0, 0, pixelCrop.width, pixelCrop.height, // source
    0, 0, outputWidth, outputHeight // destination
  )

  // As a blob
  return new Promise((resolve) => {
    finalCanvas.toBlob((file) => {
      resolve(file)
    }, options.mimeType || 'image/jpeg', options.quality ?? 0.9)
  })
}
