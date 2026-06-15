// src/Scanner.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Html5Qrcode } from "html5-qrcode";

export default function Scanner({ onScanSuccess, onScanFailure, onClose }) {
  const scannerRef = useRef(null);
  const [isScannerReady, setIsScannerReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(null);

  useEffect(() => {
    // Request camera permission first
    const checkCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop stream after checking
        setPermissionGranted(true);
        initializeScanner();
      } catch (err) {
        console.error("Camera permission denied:", err);
        setPermissionGranted(false);
        setErrorMessage("Camera access denied. Please enable camera permissions to use the scanner.");
        if (onScanFailure) onScanFailure("Camera permission denied");
      }
    };

const initializeScanner = async () => {
	try {
		const devices = await Html5Qrcode.getCameras();

		if (!devices.length) {
			setErrorMessage("No camera found");
			return;
		}

		const scanner = new Html5Qrcode("reader");
		scannerRef.current = scanner;

		const config = {
			fps: 60,
			qrbox: { width: 280, height: 280 },
		};

		await scanner.start(
			{ facingMode: "environment" }, // ✅ GUARANTEED BACK CAMERA
			config,
			(decodedText, decodedResult) => {
				playSuccessFeedback();
				onScanSuccess?.(decodedText, decodedResult);

				if (scannerRef.current) {
					scannerRef.current
						.clear()
						.then(() => {
							setIsCameraActive(false);
							setTimeout(() => {
								onClose?.();
							}, 200);
						})
						.catch(() => {
							onClose?.();
						});
				} else {
					onClose?.();
				}
			},
			(errorMessage) => {
				if (errorMessage.includes("No MultiFormat Readers")) {
					setErrorMessage("Position barcode clearly in frame");
				}
				onScanFailure?.(errorMessage);
			},
		);

		setIsCameraActive(true);
		setIsScannerReady(true);
		setErrorMessage("");
	} catch (err) {
		console.error(err);
		setErrorMessage("Failed to initialize scanner");
	}
};

    checkCameraPermission();

    // Cleanup: stop the camera when the component is hidden/unmounted
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner on unmount:", error);
        });
      }
    };
  }, [onScanSuccess, onScanFailure, onClose]);

  const playSuccessFeedback = () => {
    // Play a subtle beep sound (optional)
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      audioContext.close();
    } catch (err) {
      // Audio context might fail in some browsers, ignore
    }
  };

  const handleRetry = () => {
    setErrorMessage('');
    setPermissionGranted(null);
    window.location.reload(); // Simple reload to retry
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fadeIn">
      {/* Scanner Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              📷 Barcode Scanner
            </h3>
            <p className="text-white/80 text-xs mt-1">
              Position barcode clearly in frame for instant scanning
            </p>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors text-2xl leading-none"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scanner Content */}
      <div className="p-6">
        {/* Camera Feed */}
        <div className="relative">
          <div 
            id="reader" 
            className="overflow-hidden rounded-xl bg-black shadow-inner"
            style={{ minHeight: '300px' }}
          ></div>
          
          {/* Scanner Overlay Effects */}
          {isCameraActive && (
            <>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-scanLine"></div>
              <div className="absolute inset-0 border-2 border-green-500 rounded-xl pointer-events-none animate-pulse"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-green-500 rounded-lg pointer-events-none"></div>
            </>
          )}
        </div>

        {/* Loading State */}
        {!isScannerReady && permissionGranted === null && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm text-gray-600">Requesting camera permission...</p>
          </div>
        )}

        {/* Permission Denied State */}
        {permissionGranted === false && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">📷❌</div>
            <p className="text-sm text-red-600 font-semibold mb-2">Camera Access Denied</p>
            <p className="text-xs text-gray-500 mb-4">Please allow camera access to use the scanner feature.</p>
            <button 
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Retry Permission
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && permissionGranted !== false && (
          <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600">⚠️</span>
              <div>
                <p className="text-xs text-yellow-800 font-semibold">Scanning Tips:</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  • Ensure good lighting conditions<br />
                  • Hold the barcode steady<br />
                  • Keep appropriate distance from camera<br />
                  • Try a different barcode if scanning fails
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-blue-600 text-sm">💡</span>
            <div>
              <p className="text-xs text-blue-800 font-semibold">Quick Tips:</p>
              <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                <li>• Supports both barcodes and QR codes</li>
                <li>• Use torch button if available for low light</li>
                <li>• Scanner automatically detects codes</li>
                <li>• Will close automatically after successful scan</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Manual Entry Suggestion */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Having trouble? You can manually enter the barcode number instead.
          </p>
        </div>
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes scanLine {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(300px);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-scanLine {
          animation: scanLine 2s linear infinite;
        }
      `}</style>
    </div>
  );
}