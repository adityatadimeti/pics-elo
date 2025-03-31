import React, { useState, useEffect, useRef } from 'react';
import heic2any from 'heic2any';

const ImageCropper = ({ image, onCropComplete }) => {
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const cropBoxRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [cropBoxPos, setCropBoxPos] = useState({ x: 0, y: 0 });
  const [cropBoxSize, setCropBoxSize] = useState(100);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  // Setup crop box initial position when image loads
  useEffect(() => {
    if (imageLoaded && imageRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;
      
      // Get natural dimensions of image
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      setImageDimensions({ width: imgWidth, height: imgHeight });
      
      // Calculate the displayed dimensions while maintaining aspect ratio
      let displayWidth, displayHeight;
      
      if (imgWidth > imgHeight) {
        // Landscape
        displayWidth = container.offsetWidth;
        displayHeight = (imgHeight / imgWidth) * displayWidth;
      } else {
        // Portrait or square
        displayHeight = container.offsetHeight;
        displayWidth = (imgWidth / imgHeight) * displayHeight;
      }
      
      // Calculate the max size for the square crop box (70% of the smaller dimension)
      const maxSize = Math.min(displayWidth, displayHeight) * 0.7;
      setCropBoxSize(maxSize);
      
      // Center the crop box
      setCropBoxPos({
        x: (container.offsetWidth - maxSize) / 2,
        y: (container.offsetHeight - maxSize) / 2
      });
    }
  }, [imageLoaded]);
  
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ 
      x: e.clientX - cropBoxPos.x, 
      y: e.clientY - cropBoxPos.y 
    });
  };
  
  const handleResizeStart = (e, handle) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent dragging when resizing
    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({
      x: e.clientX,
      y: e.clientY,
      size: cropBoxSize,
      boxX: cropBoxPos.x,
      boxY: cropBoxPos.y
    });
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging && !isResizing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    if (isResizing) {
      // Handle resizing
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // Use the largest delta for keeping it square
      const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * 
                   (deltaX > 0 || deltaY > 0 ? 1 : -1);
      
      let newSize = startPos.size;
      let newX = cropBoxPos.x;
      let newY = cropBoxPos.y;
      
      // Different logic depending on which corner is being dragged
      switch (resizeHandle) {
        case 'se': // Bottom right
          newSize = Math.max(50, startPos.size + delta); // Minimum size of 50px
          break;
        case 'sw': // Bottom left
          newSize = Math.max(50, startPos.size + delta);
          newX = startPos.boxX - (newSize - startPos.size);
          break;
        case 'ne': // Top right
          newSize = Math.max(50, startPos.size + delta);
          newY = startPos.boxY - (newSize - startPos.size);
          break;
        case 'nw': // Top left
          newSize = Math.max(50, startPos.size + delta);
          newX = startPos.boxX - (newSize - startPos.size);
          newY = startPos.boxY - (newSize - startPos.size);
          break;
        default:
          break;
      }
      
      // Boundary checks
      const maxX = container.offsetWidth - newSize;
      const maxY = container.offsetHeight - newSize;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      // Adjust size if position had to be constrained
      if (newX === 0 || newX === maxX || newY === 0 || newY === maxY) {
        // Calculate the maximum possible size given the constraints
        const maxPossibleSizeX = resizeHandle.includes('w') ? 
          cropBoxPos.x + cropBoxSize : container.offsetWidth - cropBoxPos.x;
        const maxPossibleSizeY = resizeHandle.includes('n') ? 
          cropBoxPos.y + cropBoxSize : container.offsetHeight - cropBoxPos.y;
        const maxPossibleSize = Math.min(maxPossibleSizeX, maxPossibleSizeY);
        
        newSize = Math.min(newSize, maxPossibleSize);
      }
      
      setCropBoxSize(newSize);
      setCropBoxPos({ x: newX, y: newY });
    } else if (isDragging) {
      // Handle dragging
      let newX = e.clientX - startPos.x;
      let newY = e.clientY - startPos.y;
      
      // Boundary checks to keep crop box inside container
      newX = Math.max(0, Math.min(newX, container.offsetWidth - cropBoxSize));
      newY = Math.max(0, Math.min(newY, container.offsetHeight - cropBoxSize));
      
      setCropBoxPos({ x: newX, y: newY });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };
  
  // Handle touch events for mobile
  const handleTouchStart = (e, handle = null) => {
    const touch = e.touches[0];
    if (handle) {
      handleResizeStart({ 
        preventDefault: () => {}, 
        stopPropagation: () => {},
        clientX: touch.clientX, 
        clientY: touch.clientY 
      }, handle);
    } else {
      handleMouseDown({ 
        preventDefault: () => {}, 
        clientX: touch.clientX, 
        clientY: touch.clientY 
      });
    }
  };
  
  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  };
  
  const handleTouchEnd = () => {
    handleMouseUp();
  };
  
  const cropImage = () => {
    const img = imageRef.current;
    if (!img) return;
    
    const canvas = document.createElement('canvas');
    const outputSize = 600; // Consistent output size for all crops
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const ctx = canvas.getContext('2d');
    
    // Get container and displayed image dimensions
    const container = containerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Calculate image position relative to container
    const imgLeftOffset = imgRect.left - containerRect.left;
    const imgTopOffset = imgRect.top - containerRect.top;
    
    // Calculate the scaling ratio between displayed image and original image
    const displayedWidth = imgRect.width;
    const displayedHeight = imgRect.height;
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    
    const widthRatio = originalWidth / displayedWidth;
    const heightRatio = originalHeight / displayedHeight;
    
    // Calculate crop coordinates in the original image
    // Adjust for image position within container
    const sourceX = (cropBoxPos.x - imgLeftOffset) * widthRatio;
    const sourceY = (cropBoxPos.y - imgTopOffset) * heightRatio;
    const sourceSize = cropBoxSize * widthRatio;
    
    // Make sure we don't try to crop outside the image boundaries
    const validSourceX = Math.max(0, Math.min(sourceX, originalWidth - sourceSize));
    const validSourceY = Math.max(0, Math.min(sourceY, originalHeight - sourceSize));
    const validSourceSize = Math.min(
      sourceSize,
      originalWidth - validSourceX,
      originalHeight - validSourceY
    );
    
    // Draw the cropped image to the canvas
    ctx.drawImage(
      img,
      validSourceX, validSourceY, validSourceSize, validSourceSize,
      0, 0, outputSize, outputSize
    );
    
    // Convert the canvas to a data URL
    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.92);
    
    // Pass the cropped image URL to the parent component
    onCropComplete(croppedImageUrl);
  };
  
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-96 overflow-hidden bg-gray-800 flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img 
        ref={imageRef}
        src={image.url} 
        alt={image.name} 
        className="max-w-full max-h-full object-contain"
        onLoad={() => setImageLoaded(true)}
      />
      
      {imageLoaded && (
        <div 
          ref={cropBoxRef}
          className="absolute border-2 border-dashed border-blue-500 cursor-move bg-white bg-opacity-10"
          style={{
            left: `${cropBoxPos.x}px`,
            top: `${cropBoxPos.y}px`,
            width: `${cropBoxSize}px`,
            height: `${cropBoxSize}px`,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Resize handles */}
          <div 
            className="absolute w-6 h-6 right-0 bottom-0 cursor-se-resize"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onTouchStart={(e) => handleTouchStart(e, 'se')}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full absolute right-0 bottom-0"></div>
          </div>
          
          <div 
            className="absolute w-6 h-6 left-0 bottom-0 cursor-sw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
            onTouchStart={(e) => handleTouchStart(e, 'sw')}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full absolute left-0 bottom-0"></div>
          </div>
          
          <div 
            className="absolute w-6 h-6 right-0 top-0 cursor-ne-resize"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
            onTouchStart={(e) => handleTouchStart(e, 'ne')}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full absolute right-0 top-0"></div>
          </div>
          
          <div 
            className="absolute w-6 h-6 left-0 top-0 cursor-nw-resize"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
            onTouchStart={(e) => handleTouchStart(e, 'nw')}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full absolute left-0 top-0"></div>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-3 text-center">
        <p className="mb-2">Drag the box to position • Drag corners to resize</p>
        <button 
          onClick={cropImage}
          className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Confirm Crop
        </button>
      </div>
    </div>
  );
};

const PhotoComparisonApp = () => {
  const [photos, setPhotos] = useState([]);
  const [currentPair, setCurrentPair] = useState([null, null]);
  const [isUploading, setIsUploading] = useState(false);
  const [showProbability, setShowProbability] = useState(false);
  const [imagesToCrop, setImagesToCrop] = useState([]);
  const [croppingIndex, setCroppingIndex] = useState(null);
  const [croppingStep, setCroppingStep] = useState(false);
  
  // Default ELO rating for new photos
  const DEFAULT_ELO = 1500;
  
  // K-factor determines how much a single match affects the rating
  const K_FACTOR = 32;

  useEffect(() => {
    // If we have at least 2 photos and not in cropping mode, set up an initial pair
    if (photos.length >= 2 && !croppingStep) {
      selectRandomPair(photos);
    }
  }, [photos, croppingStep]);

  // Function to check if file is a HEIC image
  const isHeicImage = (file) => {
    return file.type === 'image/heic' || 
           file.type === 'image/heif' || 
           file.name.toLowerCase().endsWith('.heic') || 
           file.name.toLowerCase().endsWith('.heif');
  };

  // Function to convert HEIC to JPEG Blob
  const convertHeicToJpeg = async (file) => {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      
      // If the result is an array (shouldn't be for single files, but just in case)
      const outputBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      
      // Create a new file with the converted blob
      return new File(
        [outputBlob], 
        file.name.replace(/\.(heic|heif)$/i, '.jpg'), 
        { type: 'image/jpeg' }
      );
    } catch (error) {
      console.error('Error converting HEIC image:', error);
      throw error;
    }
  };

  // Function to process a file (convert if HEIC, or return as is)
  const processFile = async (file) => {
    if (isHeicImage(file)) {
      return await convertHeicToJpeg(file);
    }
    return file;
  };

  // Function to handle file uploads
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Process each file (convert HEIC files if needed)
      const processedFiles = await Promise.all(
        files.map(async (file) => await processFile(file))
      );
      
      // Create URL references to the processed files
      const newPhotos = processedFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        return {
          id: `upload-${Date.now()}-${index}`,
          url: url,
          name: file.name,
          originalUrl: url, // Store the original URL
          elo: DEFAULT_ELO,
          matches: 0,
          wins: 0,
        };
      });
      
      // Set these images to be cropped
      setImagesToCrop(newPhotos);
      setCroppingIndex(0);
      setCroppingStep(true);
    } catch (error) {
      console.error('Error processing files:', error);
      alert('There was an error processing some of your images. HEIC conversion may have failed.');
      setIsUploading(false);
    }
  };

  // Handle crop completion
  const handleCropComplete = (croppedImageUrl) => {
    if (croppingIndex === null || !imagesToCrop.length) return;
    
    // Update the current image with the cropped version
    const updatedImages = [...imagesToCrop];
    updatedImages[croppingIndex] = {
      ...updatedImages[croppingIndex],
      url: croppedImageUrl // Replace with the cropped version
    };
    
    setImagesToCrop(updatedImages);
    
    // Move to the next image or finish cropping
    if (croppingIndex < imagesToCrop.length - 1) {
      setCroppingIndex(croppingIndex + 1);
    } else {
      // We're done cropping, add the images to the photos array
      setPhotos(prevPhotos => [...prevPhotos, ...updatedImages]);
      setImagesToCrop([]);
      setCroppingIndex(null);
      setCroppingStep(false);
      setIsUploading(false);
    }
  };

  // Skip cropping for the current image
  const skipCropping = () => {
    if (croppingIndex === null || !imagesToCrop.length) return;
    
    // Move to the next image or finish cropping
    if (croppingIndex < imagesToCrop.length - 1) {
      setCroppingIndex(croppingIndex + 1);
    } else {
      // We're done cropping, add the images to the photos array
      setPhotos(prevPhotos => [...prevPhotos, ...imagesToCrop]);
      setImagesToCrop([]);
      setCroppingIndex(null);
      setCroppingStep(false);
      setIsUploading(false);
    }
  };

  // Calculate win probability based on ELO ratings
  const calculateWinProbability = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  };

  // Update ELO ratings after a match
  const updateEloRatings = (winnerId, loserId) => {
    setPhotos(prevPhotos => {
      return prevPhotos.map(photo => {
        if (photo.id === winnerId || photo.id === loserId) {
          // Find both photos for the calculation
          const winner = prevPhotos.find(p => p.id === winnerId);
          const loser = prevPhotos.find(p => p.id === loserId);
          
          // Calculate win probabilities
          const winnerWinProbability = calculateWinProbability(winner.elo, loser.elo);
          const loserWinProbability = calculateWinProbability(loser.elo, winner.elo);
          
          // Calculate ELO adjustments
          const winnerEloChange = Math.round(K_FACTOR * (1 - winnerWinProbability));
          const loserEloChange = Math.round(K_FACTOR * (0 - loserWinProbability));
          
          if (photo.id === winnerId) {
            return {
              ...photo,
              elo: photo.elo + winnerEloChange,
              matches: photo.matches + 1,
              wins: photo.wins + 1
            };
          } else {
            return {
              ...photo,
              elo: photo.elo + loserEloChange,
              matches: photo.matches + 1
            };
          }
        }
        return photo;
      });
    });
  };

  // Function to remove a photo
  const removePhoto = (photoId) => {
    setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== photoId));
    
    // If current pair contains this photo, select a new pair
    if (currentPair[0]?.id === photoId || currentPair[1]?.id === photoId) {
      const updatedPhotos = photos.filter(photo => photo.id !== photoId);
      if (updatedPhotos.length >= 2) {
        selectRandomPair(updatedPhotos);
      } else {
        setCurrentPair([null, null]);
      }
    }
  };

  // Function to select a random pair of photos with weighted probability
  const selectRandomPair = (photoList) => {
    if (photoList.length < 2) return;
    
    // Sort photos by ELO to implement weighted selection
    const sortedPhotos = [...photoList].sort((a, b) => b.elo - a.elo);
    
    // Select first photo with higher probability for higher-rated photos
    let photo1Index;
    
    // Use weighted random selection
    const totalWeight = sortedPhotos.reduce((sum, photo, index) => {
      const weight = photoList.length - index;
      return sum + weight;
    }, 0);
    
    let randomWeight = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    for (let i = 0; i < sortedPhotos.length; i++) {
      cumulativeWeight += (photoList.length - i);
      if (randomWeight <= cumulativeWeight) {
        photo1Index = i;
        break;
      }
    }
    
    const photo1 = sortedPhotos[photo1Index];
    
    // Remove the first photo from available options
    const remainingPhotos = sortedPhotos.filter(photo => photo.id !== photo1.id);
    
    // Select second photo - use similar weighting
    let photo2Index;
    const totalWeight2 = remainingPhotos.reduce((sum, photo, index) => {
      const weight = remainingPhotos.length - index;
      return sum + weight;
    }, 0);
    
    let randomWeight2 = Math.random() * totalWeight2;
    let cumulativeWeight2 = 0;
    
    for (let i = 0; i < remainingPhotos.length; i++) {
      cumulativeWeight2 += (remainingPhotos.length - i);
      if (randomWeight2 <= cumulativeWeight2) {
        photo2Index = i;
        break;
      }
    }
    
    const photo2 = remainingPhotos[photo2Index];
    
    setCurrentPair([photo1, photo2]);
  };

  // Function to handle user selection
  const handleSelection = (selectedPhotoId) => {
    const winnerId = selectedPhotoId;
    const loserId = currentPair[0].id === selectedPhotoId ? currentPair[1].id : currentPair[0].id;
    
    // Update ELO ratings based on the match result
    updateEloRatings(winnerId, loserId);
    
    // Select a new pair
    const updatedPhotos = photos.map(photo => {
      if (photo.id === winnerId) {
        const winner = photos.find(p => p.id === winnerId);
        const loser = photos.find(p => p.id === loserId);
        const winnerWinProbability = calculateWinProbability(winner.elo, loser.elo);
        const winnerEloChange = Math.round(K_FACTOR * (1 - winnerWinProbability));
        
        return {
          ...photo,
          elo: photo.elo + winnerEloChange,
          matches: photo.matches + 1,
          wins: photo.wins + 1
        };
      } 
      else if (photo.id === loserId) {
        const winner = photos.find(p => p.id === winnerId);
        const loser = photos.find(p => p.id === loserId);
        const loserWinProbability = calculateWinProbability(loser.elo, winner.elo);
        const loserEloChange = Math.round(K_FACTOR * (0 - loserWinProbability));
        
        return {
          ...photo,
          elo: photo.elo + loserEloChange,
          matches: photo.matches + 1
        };
      }
      return photo;
    });
    
    selectRandomPair(updatedPhotos);
  };

  // Restart the comparison with the existing photos
  const restartComparison = () => {
    // Reset all ratings to default
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => ({
        ...photo,
        elo: DEFAULT_ELO,
        matches: 0,
        wins: 0
      }))
    );
    
    // Select a new initial pair
    if (photos.length >= 2) {
      selectRandomPair(photos.map(photo => ({...photo, elo: DEFAULT_ELO, matches: 0, wins: 0})));
    }
  };

  // Function to export ratings as JSON
  const exportRatings = () => {
    const dataToExport = {
      photos: photos.map(photo => ({
        name: photo.name,
        elo: photo.elo,
        matches: photo.matches,
        wins: photo.wins
      })),
      exportDate: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'photo-elo-ratings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Function to recrop a photo
  const recropPhoto = (photoId) => {
    const photoToRecrop = photos.find(photo => photo.id === photoId);
    if (!photoToRecrop) return;
    
    // Create a temp image with the original URL
    const imageToRecrop = {
      ...photoToRecrop,
      url: photoToRecrop.originalUrl || photoToRecrop.url // Use original URL if available
    };
    
    setImagesToCrop([imageToRecrop]);
    setCroppingIndex(0);
    setCroppingStep(true);
    
    // After cropping, we need to update this specific photo
    // The handle crop complete function will now add a new photo
    // So we need to remove the old one after cropping
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);
    setPhotos(updatedPhotos);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center">Photo ELO Rating System</h1>
      
      {/* Photo Upload Section */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Upload Photos</h2>
        
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col items-center px-4 py-2 bg-white text-blue-500 rounded-lg shadow-lg tracking-wide border border-blue-500 cursor-pointer hover:bg-blue-500 hover:text-white">
            <span className="mt-2 text-base leading-normal">Select photos</span>
            <input 
              type="file" 
              multiple 
              accept="image/*,.heic,.heif" 
              onChange={handleFileUpload} 
              className="hidden"
              webkitdirectory
            />
          </label>
          
          <span className="text-sm text-gray-500">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} uploaded
          </span>
          
          {photos.length >= 2 && !croppingStep && (
            <button 
              onClick={restartComparison}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Reset Ratings
            </button>
          )}
          
          {photos.length > 0 && !croppingStep && (
            <button 
              onClick={exportRatings}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Export Ratings
            </button>
          )}
        </div>
        
        {isUploading && !croppingStep && <p className="mt-2">Converting and uploading images...</p>}
      </div>
      
      {/* Cropping Section */}
      {croppingStep && croppingIndex !== null && imagesToCrop.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-center">
            Crop Image {croppingIndex + 1} of {imagesToCrop.length}
          </h2>
          
          <div className="mb-4">
            <ImageCropper 
              image={imagesToCrop[croppingIndex]} 
              onCropComplete={handleCropComplete} 
            />
          </div>
          
          <div className="flex justify-center gap-4 mt-4">
            <button 
              onClick={skipCropping}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Skip Cropping
            </button>
          </div>
        </div>
      )}
      
      {/* Comparison Section - Only show if we have at least 2 photos and not in cropping mode */}
      {!croppingStep && photos.length >= 2 && currentPair[0] && currentPair[1] ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-center">Which photo do you prefer?</h2>
          
          <div className="grid grid-cols-2 gap-8">
            {currentPair.map((photo, index) => (
              photo && (
                <div 
                  key={photo.id} 
                  className="flex flex-col items-center cursor-pointer hover:opacity-90 transition"
                  onClick={() => handleSelection(photo.id)}
                >
                  <div className="w-full aspect-square bg-black overflow-hidden">
                    <img 
                      src={photo.url} 
                      alt={photo.name} 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-lg">{photo.name}</p>
                    <p className="text-sm text-gray-600">ELO: {photo.elo}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      ) : !croppingStep && photos.length < 2 ? (
        <div className="mb-8 p-6 border rounded-lg bg-gray-50 text-center">
          <p>Upload at least 2 photos to start comparing.</p>
          <p className="text-sm text-gray-500 mt-2">JPG, PNG, GIF, and HEIC formats are supported. All images will be cropped to square.</p>
        </div>
      ) : null}
      
      {/* Leaderboard Section - Only show if we have photos and not in cropping mode */}
      {!croppingStep && photos.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-center">Photo Rankings (by ELO)</h2>
          <div className="overflow-hidden border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ELO Rating</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W/L/Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...photos]
                  .sort((a, b) => b.elo - a.elo)
                  .map((photo, index) => (
                  <tr key={photo.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-black flex-shrink-0 rounded-full overflow-hidden mr-2">
                          <img src={photo.url} alt={photo.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="truncate max-w-xs">{photo.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{photo.elo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {photo.wins} / {photo.matches - photo.wins} / {photo.matches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => recropPhoto(photo.id)} 
                        className="text-blue-500 hover:text-blue-700 mr-4"
                      >
                        Recrop
                      </button>
                      <button 
                        onClick={() => removePhoto(photo.id)} 
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
export default PhotoComparisonApp;