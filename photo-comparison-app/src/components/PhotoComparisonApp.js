import React, { useState, useEffect } from 'react';

const PhotoComparisonApp = () => {
  const [photos, setPhotos] = useState([]);
  const [currentPair, setCurrentPair] = useState([null, null]);
  const [isUploading, setIsUploading] = useState(false);
  const [showProbability, setShowProbability] = useState(false); // Keeping the state but removing the toggle button
  
  // Default ELO rating for new photos
  const DEFAULT_ELO = 1500;
  
  // K-factor determines how much a single match affects the rating
  // Higher values mean more volatility in ratings
  const K_FACTOR = 32;

  useEffect(() => {
    // If we have at least 2 photos, set up an initial pair
    if (photos.length >= 2) {
      selectRandomPair(photos);
    }
  }, [photos]);

  // Function to handle file uploads
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;
    
    setIsUploading(true);
    
    // Create URL references to the uploaded files
    const newPhotos = files.map((file, index) => {
      // Create an object URL for the file
      const url = URL.createObjectURL(file);
      return {
        id: `upload-${Date.now()}-${index}`, // Create a unique ID
        url: url,
        name: file.name,
        elo: DEFAULT_ELO, // Set initial ELO rating
        matches: 0, // Track number of matches
        wins: 0, // Track number of wins
      };
    });
    
    // Add the new photos to our existing photos
    setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
    setIsUploading(false);
  };

  // Calculate win probability based on ELO ratings
  const calculateWinProbability = (ratingA, ratingB) => {
    // Using the standard ELO formula: P(WIN) = 1 / (1 + 10^((R2 - R1)/400))
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
    // Photos with higher ELO have higher chance of being selected
    const sortedPhotos = [...photoList].sort((a, b) => b.elo - a.elo);
    
    // Select first photo with higher probability for higher-rated photos
    let photo1Index;
    
    // Use weighted random selection: higher rated photos appear more frequently
    // This is a simple weighted selection algorithm
    const totalWeight = sortedPhotos.reduce((sum, photo, index) => {
      // Weight inversely proportional to position (higher rated = more weight)
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
    // We pass the current photos array as the updateEloRatings function
    // hasn't actually updated the state yet (it's queued)
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

  return (
    <div className="max-w-4xl mx-auto p-4">
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
              accept="image/*" 
              onChange={handleFileUpload} 
              className="hidden"
            />
          </label>
          
          <span className="text-sm text-gray-500">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} uploaded
          </span>
          
          {photos.length >= 2 && (
            <button 
              onClick={restartComparison}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Reset Ratings
            </button>
          )}
          
          {photos.length > 0 && (
            <button 
              onClick={exportRatings}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Export Ratings
            </button>
          )}
        </div>
        
        {isUploading && <p className="mt-2">Uploading...</p>}
      </div>
      
      {/* Comparison Section - Only show if we have at least 2 photos */}
      {photos.length >= 2 && currentPair[0] && currentPair[1] ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-center">Which photo do you prefer?</h2>
          
          <div className="grid grid-cols-2 gap-4">
            {currentPair.map((photo, index) => (
              photo && (
                <div 
                  key={photo.id} 
                  className="flex flex-col items-center border rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => handleSelection(photo.id)}
                >
                  <img 
                    src={photo.url} 
                    alt={photo.name} 
                    className="w-full h-64 object-cover rounded-md mb-2"
                  />
                  <div className="text-center">
                    <p className="text-lg">{photo.name}</p>
                    <p className="text-sm text-gray-600">ELO: {photo.elo}</p>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      ) : photos.length < 2 ? (
        <div className="mb-8 p-6 border rounded-lg bg-gray-50 text-center">
          <p>Upload at least 2 photos to start comparing.</p>
        </div>
      ) : null}
      
      {/* Leaderboard Section - Only show if we have photos */}
      {photos.length > 0 && (
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
                        <img src={photo.url} alt={photo.name} className="w-10 h-10 object-cover rounded-full mr-2" />
                        <span className="truncate max-w-xs">{photo.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{photo.elo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {photo.wins} / {photo.matches - photo.wins} / {photo.matches}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
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
  );
};

export default PhotoComparisonApp;