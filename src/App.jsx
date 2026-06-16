// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import toast, { Toaster } from "react-hot-toast";
import Scanner from "./Scanner";
import InventoryPanel from "./InventoryPanel";
import CreditPanel from "./CreditPanel";
import ReportsPanel from "./ReportsPanel";
import { db } from "./db";
import { useAuth } from "./contexts/AuthContext";
import { LogOut, User } from 'lucide-react';

export default function App() {
	const { user, signOut } = useAuth();
	const [showScanner, setShowScanner] = useState(false);
	const [showInventory, setShowInventory] = useState(false);
	const [showCreditPanel, setShowCreditPanel] = useState(false);
	const [showReports, setShowReports] = useState(false);
	const [manualBarcode, setManualBarcode] = useState("");
	const [notFoundCode, setNotFoundCode] = useState("");
	const [searchSuggestions, setSearchSuggestions] = useState([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
	const [selectedSale, setSelectedSale] = useState(null);
	const [showSaleDetails, setShowSaleDetails] = useState(false);
	const searchRef = useRef(null);

	const [cart, setCart] = useState([]);
	const [cashReceived, setCashReceived] = useState("");

	const [salesHistory, setSalesHistory] = useState([]);
	const [saleItems, setSaleItems] = useState([]);
	const [inventory, setInventory] = useState([]);

	const loadData = async () => {
		try {
			const [salesRes, itemsRes, inventoryRes] = await Promise.all([
				db.from("sales").select("*").order("id", { ascending: false }),
				db.from("sale_items").select("*"),
				db.from("inventory").select("*"),
			]);

			if (salesRes.error) throw salesRes.error;
			if (itemsRes.error) throw itemsRes.error;
			if (inventoryRes.error) throw inventoryRes.error;

			setSalesHistory(salesRes.data || []);
			setSaleItems(itemsRes.data || []);
			setInventory(inventoryRes.data || []);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	// Inject CSS styles
	useEffect(() => {
		const style = document.createElement("style");
		style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      
      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }
      
      .animate-shake {
        animation: shake 0.3s ease-in-out;
      }
      
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #555;
      }

      .suggestion-item {
        transition: all 0.2s ease;
      }
      
      .suggestion-item:hover {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        transform: translateX(5px);
      }
    `;
		document.head.appendChild(style);
		return () => {
			document.head.removeChild(style);
		};
	}, []);

	// Search for suggestions as user types
	useEffect(() => {
		const searchProducts = async () => {
			if (manualBarcode.trim().length < 2) {
				setSearchSuggestions([]);
				setShowSuggestions(false);
				return;
			}

			try {
				const { data: allProducts, error } = await db
					.from("inventory")
					.select("*");

				if (error) console.error(error);
				const searchTerm = manualBarcode.toLowerCase().trim();

				const results = allProducts
					.filter(
						(product) =>
							product.name.toLowerCase().includes(searchTerm) ||
							(product.barcode &&
								product.barcode.toLowerCase().includes(searchTerm)),
					)
					.slice(0, 8);

				setSearchSuggestions(results);
				setShowSuggestions(results.length > 0);
				setSelectedSuggestionIndex(-1);
			} catch (error) {
				console.error("Search failed:", error);
				toast.error("Failed to search products");
			}
		};

		const debounceTimer = setTimeout(searchProducts, 300);
		return () => clearTimeout(debounceTimer);
	}, [manualBarcode]);

	const handleKeyDown = (e) => {
		if (!showSuggestions) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedSuggestionIndex((prev) =>
					prev < searchSuggestions.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				e.preventDefault();
				if (
					selectedSuggestionIndex >= 0 &&
					searchSuggestions[selectedSuggestionIndex]
				) {
					handleSuggestionClick(searchSuggestions[selectedSuggestionIndex]);
				} else if (manualBarcode.trim()) {
					processBarcode(manualBarcode.trim());
					setManualBarcode("");
				}
				break;
			case "Escape":
				setShowSuggestions(false);
				break;
		}
	};

	const processBarcode = async (input) => {
		setNotFoundCode("");
		setShowSuggestions(false);

		try {
			let item = null;

			// exact barcode
			const { data: barcodeItem } = await db
				.from("inventory")
				.select("*")
				.eq("barcode", input)
				.maybeSingle();

			item = barcodeItem;

			// starts with product name
			if (!item) {
				const { data } = await db
					.from("inventory")
					.select("*")
					.ilike("name", `${input}%`)
					.limit(1);

				item = data?.[0];
			}

			// contains product name
			if (!item) {
				const { data } = await db.from("inventory").select("*");

				item = data?.find((i) =>
					i.name.toLowerCase().includes(input.toLowerCase()),
				);
			}

			if (item) {
				addToCart(item);

				setManualBarcode("");

				toast.success(`${item.name} added to cart!`, {
					duration: 2000,
					position: "top-right",
					icon: "🛒",
				});
			} else {
				setNotFoundCode(input);

				toast.error(`Product "${input}" not found in inventory`, {
					duration: 3000,
					position: "top-right",
				});
			}
		} catch (error) {
			console.error(error);
			toast.error("Error searching for product");
		}
	};

	const handleSuggestionClick = (product) => {
		addToCart(product);
		setManualBarcode("");
		setShowSuggestions(false);
		setSearchSuggestions([]);
		toast.success(`${product.name} added to cart!`, {
			duration: 2000,
			position: "top-right",
			icon: "🛒",
		});
	};

	const addToCart = (product) => {
		setCart((prevCart) => {
			const existingIndex = prevCart.findIndex(
				(item) => item.id === product.id,
			);
			if (existingIndex > -1) {
				const updatedCart = [...prevCart];
				if (updatedCart[existingIndex].quantity >= product.stock) {
					toast.error(`⚠️ Only ${product.stock} pcs available.`, {
						duration: 3000,
						position: "top-right",
					});
					return prevCart;
				}
				updatedCart[existingIndex].quantity += 1;
				return updatedCart;
			} else {
				if (product.stock <= 0) {
					toast.error(`⚠️ "${product.name}" is out of stock!`, {
						duration: 3000,
						position: "top-right",
					});
					return prevCart;
				}
				return [...prevCart, { ...product, quantity: 1 }];
			}
		});
	};

	const updateQuantity = (id, newQty, totalStock) => {
		if (newQty <= 0) {
			setCart((prev) => prev.filter((i) => i.id !== id));
			return;
		}
		if (newQty > totalStock) {
			toast.error(`⚠️ Only ${totalStock} items available in stock.`, {
				duration: 3000,
				position: "top-right",
			});
			return;
		}
		setCart((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, quantity: newQty } : item,
			),
		);
	};

	const handleManualQuantityChange = (id, value, totalStock) => {
		let newQty = parseInt(value);

		if (isNaN(newQty)) {
			newQty = 1;
		}

		if (newQty < 1) {
			newQty = 1;
		}

		if (newQty > totalStock) {
			toast.error(`⚠️ Only ${totalStock} items available in stock.`, {
				duration: 3000,
				position: "top-right",
			});
			newQty = totalStock;
		}

		updateQuantity(id, newQty, totalStock);
	};

	const totalAmount = cart.reduce(
		(sum, item) => sum + item.selling_price * item.quantity,
		0,
	);
	const changeDue =
		Number(cashReceived) > totalAmount ? Number(cashReceived) - totalAmount : 0;

	const handleCheckout = async () => {
		if (cart.length === 0) return;

		if (!cashReceived || cashReceived === "") {
			toast.error("⚠️ Please enter the cash tendered amount.", {
				duration: 3000,
				position: "top-right",
			});
			return;
		}

		if (Number(cashReceived) < totalAmount) {
			toast.error(
				`⚠️ Insufficient payment. Need ₱${(
					totalAmount - Number(cashReceived)
				).toFixed(2)} more.`,
				{
					duration: 3000,
					position: "top-right",
				},
			);
			return;
		}

		try {
			// Create Sale Record
			const { data: sale, error: saleError } = await db
				.from("sales")
				.insert({
					total: totalAmount,
					cash_received: Number(cashReceived),
					change_due: changeDue,
					created_at: new Date().toISOString(),
				})
				.select()
				.single();

			if (saleError) throw saleError;

			// Save Sale Items and Update Inventory
			for (const item of cart) {
				const { error: itemError } = await db.from("sale_items").insert({
					sale_id: sale.id,
					product_id: item.id,
					quantity: item.quantity,
					price: item.selling_price,
					subtotal: item.selling_price * item.quantity,
				});

				if (itemError) throw itemError;

				const { data: dbItem, error: inventoryError } = await db
					.from("inventory")
					.select("stock")
					.eq("id", item.id)
					.single();

				if (inventoryError) throw inventoryError;

				if (!dbItem) {
					throw new Error(`Inventory item with ID ${item.id} not found.`);
				}

				const { error: updateError } = await db
					.from("inventory")
					.update({
						stock: Math.max(0, Number(dbItem.stock) - Number(item.quantity)),
					})
					.eq("id", item.id);

				if (updateError) throw updateError;
			}

			await Swal.fire({
				title: "🎉 Sale Complete!",
				html: `
				<div class="text-left">
					<p><strong>Total Amount:</strong> ₱${totalAmount.toFixed(2)}</p>
					<p><strong>Cash Tendered:</strong> ₱${Number(cashReceived).toFixed(2)}</p>
					<p><strong>Change Due:</strong> ₱${changeDue.toFixed(2)}</p>
				</div>
			`,
				icon: "success",
				confirmButtonColor: "#10b981",
				confirmButtonText: "Done",
				timer: 3000,
				timerProgressBar: true,
			});

			// Refresh all data
			await loadData();

			// Clear cart
			setCart([]);
			setCashReceived("");

			toast.success("Transaction completed successfully!", {
				duration: 2000,
				position: "top-right",
			});
		} catch (err) {
			console.error("Checkout error:", err);

			Swal.fire({
				title: "Transaction Failed",
				text: err.message || "Please try again.",
				icon: "error",
				confirmButtonColor: "#ef4444",
				confirmButtonText: "OK",
			});
		}
	};

	const handleExportBackup = async () => {
		const result = await Swal.fire({
			title: "Export Backup?",
			text: "This will download a JSON file with all your store data.",
			icon: "question",
			showCancelButton: true,
			confirmButtonColor: "#3b82f6",
			cancelButtonColor: "#6b7280",
			confirmButtonText: "Yes, export",
			cancelButtonText: "Cancel",
		});

		if (result.isConfirmed) {
			try {
				const inventory = await db.from("inventory").toArray();
				const sales = await db.from("sales").toArray();
				const saleItems = await db.from("sale_items").toArray();
				const creditLogs = await db.creditLog.toArray();

				const backupData = JSON.stringify(
					{ inventory, sales, saleItems, creditLogs },
					null,
					2,
				);
				const blob = new Blob([backupData], { type: "application/json" });
				const url = URL.createObjectURL(blob);

				const a = document.createElement("a");
				a.href = url;
				a.download = `sarisari_store_backup_${new Date().toISOString().split("T")[0]}.json`;
				a.click();
				URL.revokeObjectURL(url);

				toast.success("Backup exported successfully!", {
					duration: 3000,
					position: "top-right",
				});
			} catch (err) {
				Swal.fire({
					title: "Error!",
					text: "Failed to export backup file.",
					icon: "error",
					confirmButtonColor: "#ef4444",
				});
			}
		}
	};

	const viewSaleDetails = (sale) => {
		const items = saleItems.filter((item) => item.sale_id === sale.id);
		setSelectedSale({ ...sale, items });
		setShowSaleDetails(true);
	};

	const handleClearCart = async () => {
		const result = await Swal.fire({
			title: "Clear Cart?",
			text: "Are you sure you want to remove all items from your cart?",
			icon: "warning",
			showCancelButton: true,
			confirmButtonColor: "#ef4444",
			cancelButtonColor: "#6b7280",
			confirmButtonText: "Yes, clear cart",
			cancelButtonText: "No, keep items",
		});

		if (result.isConfirmed) {
			setCart([]);
			toast.success("Cart cleared successfully", {
				duration: 2000,
				position: "top-right",
			});
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 font-sans">
			{/* Toast Container */}
			<Toaster
				position="top-right"
				toastOptions={{
					duration: 3000,
					style: {
						background: "#363636",
						color: "#fff",
					},
					success: {
						duration: 2000,
						iconTheme: {
							primary: "#10b981",
							secondary: "#fff",
						},
					},
					error: {
						duration: 3000,
						iconTheme: {
							primary: "#ef4444",
							secondary: "#fff",
						},
					},
				}}
			/>

			{/* Modern Header */}
			<header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
				<div className="flex justify-between items-center">
					<div className="flex items-center space-x-3">
					<div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl shadow-lg">
						<span className="text-2xl">🏪</span>
					</div>
					<div>
						<h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
						LM SariHub
						</h1>
						<p className="text-xs text-gray-500 font-medium">
						Online Store Manager v1.0
						</p>
					</div>
					</div>

					<div className="flex items-center gap-4">
					{/* User Info */}
					<div className="hidden md:flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl">
						<div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
						<User size={16} className="text-white" />
						</div>
						<div className="text-left">
						<p className="text-xs font-medium text-gray-600">Welcome,</p>
						<p className="text-sm font-semibold text-gray-800">
							{user?.user_metadata?.full_name || user?.email?.split('@')[0]}
						</p>
						</div>
					</div>

					{/* Logout Button */}
					<button
						onClick={signOut}
						className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all duration-200 hover:shadow-lg flex items-center gap-2"
					>
						<LogOut size={16} />
						<span className="hidden md:inline">Logout</span>
					</button>
					</div>
				</div>

				{/* Action Buttons - Your existing code */}
				<div className="flex gap-3 mt-4">
					<button
					onClick={handleExportBackup}
					className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105">
					💾 Backup Data
					</button>

					<button
					onClick={() => setShowInventory(!showInventory)}
					className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-all duration-200 hover:shadow-lg hover:scale-105">
					{showInventory ? "🛒 POS Register" : "📦 Inventory"}
					</button>

					<button
					onClick={() => setShowCreditPanel(true)}
					className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105">
					📝 Credit
					</button>

					<button
					onClick={() => setShowReports(true)}
					className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105">
					📊 Reports
					</button>
				</div>
				</div>
			</header>

			{showInventory ? (
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<InventoryPanel initialBarcode={notFoundCode} />
				</div>
			) : (
				<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
						{/* Left Column - Search & History */}
						<div className="lg:col-span-2 space-y-6">
							{/* Barcode Search Card */}
							<div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-visible hover:shadow-2xl transition-shadow duration-300">
								<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3">
									<h3 className="font-googlesans text-white font-semibold text-sm flex items-center gap-2">
										🔍 Scan or Search Product
									</h3>
								</div>
								<div className="p-5">
									<div className="relative" ref={searchRef}>
										<form
											onSubmit={(e) => {
												e.preventDefault();
												if (manualBarcode.trim()) {
													processBarcode(manualBarcode.trim());
													setManualBarcode("");
												}
											}}
											className="flex gap-2">
											<div className="flex-1 relative">
												<input
													type="text"
													value={manualBarcode}
													onChange={(e) => setManualBarcode(e.target.value)}
													onKeyDown={handleKeyDown}
													onFocus={() =>
														manualBarcode.trim().length >= 2 &&
														setShowSuggestions(true)
													}
													placeholder="Search by name or barcode..."
													className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 font-medium"
													autoFocus
												/>
												<span className="absolute left-3 top-3.5 text-gray-400">
													🔍
												</span>
											</div>
											<button
												type="button"
												onClick={() => setShowScanner(!showScanner)}
												className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 ${
													showScanner
														? "bg-red-500 text-white hover:bg-red-600"
														: "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg"
												}`}>
												{showScanner ? "❌ Close" : "📷 Scan"}
											</button>
										</form>

										{showSuggestions && searchSuggestions.length > 0 && (
											<>
												<div
													className="fixed inset-0 z-40"
													onClick={() => setShowSuggestions(false)}
												/>
												<div
													className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-fadeIn"
													style={{ maxHeight: "400px" }}>
													<div
														className="overflow-y-auto custom-scrollbar"
														style={{ maxHeight: "360px" }}>
														{searchSuggestions.map((product, index) => (
															<div
																key={product.id}
																onClick={() => handleSuggestionClick(product)}
																className={`suggestion-item p-3 cursor-pointer border-b border-gray-100 last:border-0 transition-all ${
																	index === selectedSuggestionIndex
																		? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
																		: "hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
																}`}>
																<div className="flex justify-between items-center">
																	<div className="flex-1 min-w-0">
																		<div className="flex items-center gap-2">
																			<span className="text-lg flex-shrink-0">
																				📦
																			</span>
																			<div className="min-w-0 flex-1">
																				<p
																					className={`font-semibold text-sm truncate ${index === selectedSuggestionIndex ? "text-white" : "text-gray-800"}`}>
																					{product.name}
																				</p>
																				{product.barcode && (
																					<p
																						className={`text-xs mt-0.5 font-mono truncate ${index === selectedSuggestionIndex ? "text-white/80" : "text-gray-400"}`}>
																						🔖 {product.barcode}
																					</p>
																				)}
																			</div>
																		</div>
																	</div>
																	<div className="text-right flex-shrink-0 ml-3">
																		<p
																			className={`font-bold text-base ${index === selectedSuggestionIndex ? "text-white" : "text-green-600"}`}>
																			₱{product.selling_price.toFixed(2)}
																		</p>
																		<p
																			className={`text-xs ${index === selectedSuggestionIndex ? "text-white/80" : "text-gray-500"}`}>
																			Stock: {product.stock}
																		</p>
																	</div>
																</div>
																{product.stock === 0 && (
																	<div
																		className={`mt-2 text-xs ${index === selectedSuggestionIndex ? "text-yellow-200" : "text-red-500"} bg-red-50/50 p-1.5 rounded-lg`}>
																		⚠️ Out of stock
																	</div>
																)}
															</div>
														))}
													</div>
													<div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-t border-gray-200 sticky bottom-0">
														<span className="font-googlesans flex items-center gap-2 flex-wrap">
															🔽 Use arrow keys • ⏎ Select • ⎋ Close
														</span>
													</div>
												</div>
											</>
										)}
									</div>

									{showScanner && (
										<div className="mt-4 animate-fadeIn">
											<Scanner
												onScanSuccess={(code) => {
													processBarcode(code);
													setShowScanner(false);
												}}
											/>
										</div>
									)}

									{notFoundCode && (
										<div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-200 animate-shake">
											<div className="flex items-center justify-between flex-wrap gap-3">
												<div className="flex items-center gap-2">
													<span className="text-2xl">⚠️</span>
													<div>
														<p className="text-sm font-semibold text-red-800">
															Product Not Found
														</p>
														<p className="text-xs text-gray-600 font-mono">
															Search: {notFoundCode}
														</p>
													</div>
												</div>
												<button
													onClick={() => setShowInventory(true)}
													className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all">
													+ Register Product
												</button>
											</div>
										</div>
									)}
								</div>
							</div>

							{/* Sales History Card with Clickable Items */}
							<div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
								<div className="bg-gradient-to-r from-gray-700 to-gray-900 px-5 py-3">
									<h3 className="text-white font-semibold text-sm flex items-center gap-2">
										📊 Transaction History
									</h3>
								</div>
								<div className="p-5">
									<div className="max-h-[320px] overflow-y-auto space-y-2 custom-scrollbar">
										{salesHistory.length === 0 && (
											<div className="text-center py-12">
												<div className="text-5xl mb-3">🛒</div>
												<p className="text-gray-400 font-medium">
													No transactions yet
												</p>
												<p className="text-xs text-gray-300 mt-1">
													Complete a sale to see history
												</p>
											</div>
										)}
										{salesHistory.map((sale) => (
											<div
												key={sale.id}
												onClick={() => viewSaleDetails(sale)}
												className="group flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-200 cursor-pointer">
												<div className="flex items-center gap-3">
													<div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
														<span className="text-sm">✓</span>
													</div>
													<div>
														<p className="text-xs text-gray-500 font-medium">
															{new Date(sale.created_at).toLocaleTimeString(
																[],
																{
																	hour: "2-digit",
																	minute: "2-digit",
																	hour12: true,
																},
															)}
														</p>
														<p className="text-[10px] text-gray-400">
															Sale #{sale.id}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="font-bold text-gray-800">
														₱{sale.total.toFixed(2)}
													</p>
													<p className="text-[10px] text-gray-400">
														Tap to view details
													</p>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Right Column - Shopping Cart */}
						<div className="lg:col-span-3">
							<div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-full flex flex-col">
								{/* Cart Header */}
								<div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
									<div className="flex justify-between items-center">
										<div>
											<h2 className="text-white font-bold text-lg flex items-center gap-2">
												🛒 Shopping Cart
												{cart.length > 0 && (
													<span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
														{cart.reduce((sum, item) => sum + item.quantity, 0)}{" "}
														items
													</span>
												)}
											</h2>
											<p className="text-white/80 text-xs mt-1">
												Review and checkout your items
											</p>
										</div>
										{cart.length > 0 && (
											<button
												onClick={handleClearCart}
												className="text-white/80 hover:text-white text-sm font-semibold transition-colors">
												Clear All
											</button>
										)}
									</div>
								</div>

								{/* Cart Items with Manual Quantity Input */}
								<div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
									{cart.length === 0 ? (
										<div className="flex flex-col items-center justify-center py-16 px-4">
											<div className="text-7xl mb-4 opacity-30">🛒</div>
											<p className="text-gray-400 font-medium text-center">
												Your cart is empty
											</p>
											<p className="text-xs text-gray-300 text-center mt-1">
												Start typing product name above to search and add items
											</p>
										</div>
									) : (
										<div className="divide-y divide-gray-100">
											{cart.map((item) => (
												<div
													key={item.id}
													className="p-5 hover:bg-gray-50 transition-colors duration-150">
													<div className="flex justify-between items-start mb-3">
														<div className="flex-1">
															<h4 className="font-bold text-gray-800 text-base">
																{item.name}
															</h4>
															<div className="flex items-center gap-2 mt-1">
																<span className="text-xs text-gray-500">
																	SKU: {item.barcode || "N/A"}
																</span>
																<span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
																	₱{item.selling_price.toFixed(2)} each
																</span>
															</div>
														</div>
														<button
															onClick={() =>
																updateQuantity(item.id, 0, item.stock)
															}
															className="text-gray-400 hover:text-red-500 transition-colors">
															✕
														</button>
													</div>
													<div className="flex justify-between items-center">
														<div className="flex items-center gap-4">
															<div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
																<button
																	onClick={() =>
																		updateQuantity(
																			item.id,
																			item.quantity - 1,
																			item.stock,
																		)
																	}
																	className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors font-bold">
																	-
																</button>
																<input
																	type="number"
																	value={item.quantity}
																	onChange={(e) =>
																		handleManualQuantityChange(
																			item.id,
																			e.target.value,
																			item.stock,
																		)
																	}
																	className="w-16 text-center py-1.5 text-sm font-bold text-gray-800 border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
																	min="1"
																	max={item.stock}
																/>
																<button
																	onClick={() =>
																		updateQuantity(
																			item.id,
																			item.quantity + 1,
																			item.stock,
																		)
																	}
																	className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors font-bold">
																	+
																</button>
															</div>
															<div className="text-sm text-gray-500">
																Stock: {item.stock} left
															</div>
														</div>
														<div className="text-right">
															<p className="font-bold text-gray-800 text-lg">
																₱
																{(item.selling_price * item.quantity).toFixed(
																	2,
																)}
															</p>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>

								{/* Checkout Section */}
								{cart.length > 0 && (
									<div className="border-t-2 border-gray-100 bg-gray-50 p-6">
										<div className="flex justify-between items-center mb-4 pb-4 border-b-2 border-gray-200">
											<span className="text-gray-600 font-semibold">
												Total Amount
											</span>
											<span className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
												₱{totalAmount.toFixed(2)}
											</span>
										</div>

										<div className="grid grid-cols-2 gap-4 mb-5">
											<div>
												<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
													Cash Tendered <span className="text-red-500">*</span>
												</label>
												<div className="relative">
													<span className="absolute left-3 top-3 text-gray-400">
														₱
													</span>
													<input
														type="number"
														value={cashReceived}
														onChange={(e) => setCashReceived(e.target.value)}
														placeholder="0.00"
														className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none transition-all font-semibold text-lg"
														required
													/>
												</div>
												{!cashReceived && (
													<p className="text-xs text-red-500 mt-1">
														* Required for checkout
													</p>
												)}
											</div>
											<div>
												<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
													Change Due
												</label>
												<div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-xl border-2 border-green-200">
													<p className="text-2xl font-bold text-green-600">
														₱{changeDue.toFixed(2)}
													</p>
												</div>
											</div>
										</div>

										<button
											onClick={handleCheckout}
											disabled={
												cart.length === 0 ||
												!cashReceived ||
												cashReceived === "" ||
												Number(cashReceived) < totalAmount
											}
											className={`w-full py-4 rounded-xl font-bold text-lg uppercase tracking-wider transition-all duration-200 ${
												cart.length === 0 ||
												!cashReceived ||
												cashReceived === "" ||
												Number(cashReceived) < totalAmount
													? "bg-gray-300 text-gray-500 cursor-not-allowed"
													: "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-2xl hover:scale-105 active:scale-95"
											}`}>
											💵 Complete Sale
										</button>

										{cashReceived && Number(cashReceived) < totalAmount && (
											<div className="mt-3 p-2 bg-red-50 rounded-lg text-center animate-pulse">
												<p className="text-xs text-red-600 font-semibold">
													⚠️ Insufficient amount. Please enter ₱
													{(totalAmount - Number(cashReceived)).toFixed(2)}{" "}
													more.
												</p>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>
				</main>
			)}

			{/* Sale Details Modal */}
			{showSaleDetails && selectedSale && (
				<div
					className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
					onClick={() => setShowSaleDetails(false)}>
					<div
						className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
						onClick={(e) => e.stopPropagation()}>
						<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
							<div className="flex justify-between items-center">
								<div>
									<h3 className="text-white font-bold text-lg flex items-center gap-2">
										📋 Sale Details
									</h3>
									<p className="text-white/80 text-xs mt-1">
										Transaction #{selectedSale.id}
									</p>
								</div>
								<button
									onClick={() => setShowSaleDetails(false)}
									className="text-white/80 hover:text-white text-2xl leading-none">
									✕
								</button>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
							{/* Sale Info */}
							<div className="bg-gray-50 rounded-xl p-4 mb-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-xs text-gray-500">Date & Time</p>
										<p className="text-sm font-semibold text-gray-800">
											{new Date(selectedSale.created_at).toLocaleString()}
										</p>
									</div>
									<div>
										<p className="text-xs text-gray-500">Total Amount</p>
										<p className="text-xl font-bold text-green-600">
											₱{selectedSale.total.toFixed(2)}
										</p>
									</div>
									<div>
										<p className="text-xs text-gray-500">Cash Tendered</p>
										<p className="text-sm font-semibold text-gray-800">
											₱{selectedSale.cash_received?.toFixed(2) || "0.00"}
										</p>
									</div>
									<div>
										<p className="text-xs text-gray-500">Change Due</p>
										<p className="text-sm font-semibold text-blue-600">
											₱{selectedSale.change_due?.toFixed(2) || "0.00"}
										</p>
									</div>
								</div>
							</div>

							{/* Items Sold */}
							<h4 className="font-bold text-gray-800 mb-3">Items Sold</h4>
							<div className="space-y-2">
								{selectedSale.items.map((item, idx) => {
									const product = inventory.find(
										(p) => p.id === item.product_id,
									);
									return (
										<div
											key={idx}
											className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow">
											<div className="flex justify-between items-start mb-2">
												<div>
													<p className="font-semibold text-gray-800">
														{item.product_name || product?.name}
													</p>
													<p className="text-xs text-gray-500">
														₱
														{item.price?.toFixed(2) ||
															product?.selling_price?.toFixed(2)}{" "}
														each
													</p>
												</div>
												<p className="font-bold text-gray-800">
													₱
													{item.subtotal?.toFixed(2) ||
														(
															item.quantity *
															(item.price || product?.selling_price)
														).toFixed(2)}
												</p>
											</div>
											<div className="flex justify-between items-center">
												<div className="flex items-center gap-2">
													<span className="text-xs text-gray-500">
														Quantity:
													</span>
													<span className="font-semibold text-gray-700">
														{item.quantity} pcs
													</span>
												</div>
												{product?.barcode && (
													<span className="text-[10px] font-mono text-gray-400">
														SKU: {product.barcode}
													</span>
												)}
											</div>
										</div>
									);
								})}
							</div>

							{/* Summary */}
							<div className="mt-4 pt-4 border-t-2 border-gray-200">
								<div className="flex justify-between items-center">
									<span className="font-bold text-gray-800">Total Items:</span>
									<span className="font-semibold text-gray-700">
										{selectedSale.items.reduce(
											(sum, item) => sum + item.quantity,
											0,
										)}{" "}
										pcs
									</span>
								</div>
							</div>
						</div>

						<div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
							<button
								onClick={() => setShowSaleDetails(false)}
								className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{showCreditPanel && (
				<CreditPanel onClose={() => setShowCreditPanel(false)} />
			)}

			{showReports && <ReportsPanel onClose={() => setShowReports(false)} />}
		</div>
	);
}
