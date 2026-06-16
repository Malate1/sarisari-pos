// src/InventoryPanel.jsx
import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import toast, { Toaster } from "react-hot-toast";
import { db } from "./db";
import Scanner from "./Scanner";

export default function InventoryPanel({ initialBarcode }) {
	// Pull inventory reactively from IndexedDB using useLiveQuery
	const [inventoryList, setInventoryList] = useState([]);
	const [showScanner, setShowScanner] = useState(false);

	

	useEffect(() => {
		loadInventory();
	}, []);

	const loadInventory = async () => {
		const { data, error } = await db
			.from("inventory")
			.select("*")
			.order("id", { ascending: false });

		if (error) {
			console.error(error);
			return;
		}

		setInventoryList(data || []);
	};

	const processInventoryBarcode = async (code) => {
	try {
		console.log('Processing barcode:', code);
		
		// Query the database for the barcode
		const { data, error } = await db
		.from('inventory')
		.select('*')
		.eq('barcode', code);
		
		console.log('Query result:', { data, error });
		
		if (error) {
		console.error('Supabase error:', error);
		toast.error(`Database error: ${error.message}`, {
			duration: 3000,
			position: 'top-right',
		});
		return;
		}
		
		if (data && data.length > 0) {
		// Product found - fill the form with existing data
		const product = data[0];
		console.log('Product found:', product);
		
		setEditingId(product.id);
		setName(product.name);
		setBarcode(product.barcode);
		setCost_price(product.cost_price || '');
		setSelling_price(product.selling_price || '');
		setStock(product.stock || '');
		
		toast.success(`Product "${product.name}" loaded! 🎉`, {
			duration: 2000,
			position: 'top-right',
		});
		} else {
		// Product not found - offer to add it
		console.log('Product not found for barcode:', code);
		
		const result = await Swal.fire({
			title: '📦 New Product Detected',
			html: `
			<div class="text-left">
				<p class="mb-2">Barcode <strong>${code}</strong> is not registered in inventory.</p>
				<p class="text-sm text-gray-500">Would you like to add this product?</p>
			</div>
			`,
			icon: 'info',
			showCancelButton: true,
			confirmButtonColor: '#3b82f6',
			cancelButtonColor: '#6b7280',
			confirmButtonText: '✅ Yes, Add Product',
			cancelButtonText: '❌ No, Cancel',
		});
		
		if (result.isConfirmed) {
			// Pre-fill the barcode and clear other fields for new product
			setEditingId(null);
			setBarcode(code);
			setName('');
			setCost_price('');
			setSelling_price('');
			setStock('');
			
			// Focus on the name field
			setTimeout(() => {
			document.getElementById('product-name')?.focus();
			}, 300);
			
			toast.success('Ready to add new product! Fill in the details below.', {
			duration: 3000,
			position: 'top-right',
			});
		} else {
			toast.info('Product addition cancelled.', {
			duration: 2000,
			position: 'top-right',
			});
		}
		}
	} catch (error) {
		console.error('Error processing barcode:', error);
		toast.error(`Error: ${error.message || 'Please try again'}`, {
		duration: 3000,
		position: 'top-right',
		});
	}
	};
	
	// Handle manual barcode entry
	const handleBarcodeSubmit = (e) => {
		if (e.key === 'Enter' && barcode.trim()) {
		processInventoryBarcode(barcode.trim());
		}
	};

	// Form State Values
	const [editingId, setEditingId] = useState(null);
	const [name, setName] = useState("");
	const [barcode, setBarcode] = useState(initialBarcode || "");
	const [cost_price, setCost_price] = useState("");
	const [selling_price, setSelling_price] = useState("");
	const [stock, setStock] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState("all");

	// Update barcode when initialBarcode prop changes
	useEffect(() => {
		if (initialBarcode) {
			setBarcode(initialBarcode);
		}
	}, [initialBarcode]);

	// Handle saving new products or updating existing items
	const handleSaveProduct = async (e) => {
		e.preventDefault();
		if (!name || !selling_price)
			return alert("⚠️ Product Name and Selling Price are required.");
		try {
			if (editingId) {
				const { error } = await db
					.from("inventory")
					.update({
						name,
						barcode: barcode.trim() || null,
						cost_price: Number(cost_price) || 0,
						selling_price: Number(selling_price),
						stock: Number(stock) || 0
					})
					.eq("id", editingId);

				if (error) throw error;

				alert("✅ Product updated successfully!");
				setEditingId(null);
			} else {
				const { error } = await db.from("inventory").insert({
					name,
					barcode: barcode.trim() || null,
					cost_price: Number(cost_price) || 0,
					selling_price: Number(selling_price),
					stock: Number(stock) || 0,
					created_at: new Date().toISOString()
				});

				if (error) throw error;

				alert("🎉 Product added successfully!");
			}

			setName("");
			setBarcode("");
			setCost_price("");
			setSelling_price("");
			setStock("");

			await loadInventory();
		} catch (error) {
			console.error(error);
			alert(`❌ ${error.message}`);
		}
	};

	// Populate data inputs into form fields for correction editing
	const startEdit = (item) => {
		setEditingId(item.id);
		setName(item.name);
		setBarcode(item.barcode || "");
		setCost_price(item.cost_price);
		setSelling_price(item.selling_price);
		setStock(item.stock);
		// Smooth scroll to form
		document
			.getElementById("product-form")
			?.scrollIntoView({ behavior: "smooth" });
	};

	// Delete product entry from IndexedDB permanently
	const deleteItem = async (id, productName) => {
		if (
			confirm(
				`⚠️ Delete "${productName}" from your store inventory registry permanently?`,
			)
		) {
			const { error } = await db.from("inventory").delete().eq("id", id);

			if (error) {
				console.error(error);
				return;
			}

			await loadInventory();
			alert("🗑️ Product deleted successfully!");
		}
	};

	// Filter products based on search term and stock status
	const filteredProducts = inventoryList.filter((item) => {
		const matchesSearch =
			item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			(item.barcode &&
				item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
		const matchesCategory =
			selectedCategory === "all"
				? true
				: selectedCategory === "lowStock"
					? item.stock < 5
					: selectedCategory === "outOfStock"
						? item.stock === 0
						: true;
		return matchesSearch && matchesCategory;
	});

	// Statistics
	const totalProducts = inventoryList.length;
	const lowStockCount = inventoryList.filter(
		(item) => item.stock < 5 && item.stock > 0,
	).length;
	const outOfStockCount = inventoryList.filter(
		(item) => item.stock === 0,
	).length;
	const totalValue = inventoryList.reduce(
		(sum, item) => sum + (item.selling_price || 0) * (item.stock || 0),
		0,
	);

	return (
		<div className="space-y-6">
			{/* Header Stats Section */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">
								Total Products
							</p>
							<p className="text-3xl font-bold mt-1">{totalProducts}</p>
						</div>
						<div className="text-4xl opacity-80">📦</div>
					</div>
				</div>

				<div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-yellow-100 text-xs font-semibold uppercase tracking-wider">
								Low Stock
							</p>
							<p className="text-3xl font-bold mt-1">{lowStockCount}</p>
						</div>
						<div className="text-4xl opacity-80">⚠️</div>
					</div>
				</div>

				<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-red-100 text-xs font-semibold uppercase tracking-wider">
								Out of Stock
							</p>
							<p className="text-3xl font-bold mt-1">{outOfStockCount}</p>
						</div>
						<div className="text-4xl opacity-80">❌</div>
					</div>
				</div>

				<div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-green-100 text-xs font-semibold uppercase tracking-wider">
								Inventory Value
							</p>
							<p className="text-2xl font-bold mt-1">
								₱{totalValue.toFixed(2)}
							</p>
						</div>
						<div className="text-4xl opacity-80">💰</div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
				{/* Input Management Form Block */}
				<section className="lg:col-span-2">
					<div
						id="product-form"
						className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
						<div
							className={`bg-gradient-to-r ${editingId ? "from-orange-500 to-red-500" : "from-blue-600 to-purple-600"} px-6 py-4`}>
							<h2 className="font-googlesans text-white font-bold text-lg flex items-center gap-2">
								{editingId ? "✏️ Edit Product" : "➕ Add New Product"}
							</h2>
							<p className="text-white/80 text-xs mt-1">
								{editingId
									? "Update product information"
									: "Register a new item to inventory"}
							</p>
						</div>

						<form onSubmit={handleSaveProduct} className="p-6 space-y-4">
							<div>
								<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
									Product Name <span className="font-googlesans text-red-500">*</span>
								</label>
								<input
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g., Century Tuna Hot & Spicy 155g"
									className="font-googlesans w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 font-medium text-sm"
									required
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
									Barcode / SKU
								</label>
								<div className="relative">
									<span className="absolute left-3 top-3.5 text-gray-400">
										🔖
									</span>
									<input
										type="text"
										value={barcode}
										onChange={(e) => setBarcode(e.target.value)}
										placeholder="Scan or enter barcode"
										className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 font-mono text-sm"
									/>

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
								</div>
								
								{showScanner && (
									<div className="mt-4 animate-fadeIn">
										<Scanner
											onScanSuccess={(code) => {
												processInventoryBarcode(code);
												setShowScanner(false);
											}}
										/>
									</div>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
										Cost Price (₱)
									</label>
									<div className="relative">
										<span className="absolute left-3 top-3.5 text-gray-400">
											₱
										</span>
										<input
											type="number"
											step="0.01"
											value={cost_price}
											onChange={(e) => setCost_price(e.target.value)}
											placeholder="0.00"
											className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 text-sm"
										/>
									</div>
								</div>
								<div>
									<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
										Selling Price (₱) <span className="text-red-500">*</span>
									</label>
									<div className="relative">
										<span className="absolute left-3 top-3.5 text-gray-400">
											₱
										</span>
										<input
											type="number"
											step="0.01"
											value={selling_price}
											onChange={(e) => setSelling_price(e.target.value)}
											placeholder="0.00"
											className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 text-sm font-semibold"
											required
										/>
									</div>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
									Initial Stock Quantity
								</label>
								<input
									type="number"
									value={stock}
									onChange={(e) => setStock(e.target.value)}
									placeholder="0"
									className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 text-sm"
								/>
							</div>

							<div className="flex gap-3 pt-4">
								<button
									type="submit"
									className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 ${
										editingId
											? "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:scale-105"
											: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105"
									}`}>
									{editingId ? "✏️ Update Product" : "➕ Add Product"}
								</button>
								{editingId && (
									<button
										type="button"
										onClick={() => {
											setEditingId(null);
											setName("");
											setBarcode("");
											setCost_price("");
											setSelling_price("");
											setStock("");
										}}
										className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all duration-200">
										Cancel
									</button>
								)}
							</div>
						</form>
					</div>
				</section>

				{/* Database Sheet Explorer Block */}
				<section className="lg:col-span-3">
					<div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full">
						<div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
								<div>
									<h2 className="text-white font-bold text-lg flex items-center gap-2">
										📦 Inventory Directory
										<span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
											{filteredProducts.length} items
										</span>
									</h2>
									<p className="text-gray-300 text-xs mt-1">
										Manage your store products
									</p>
								</div>

								{/* Search and Filter */}
								<div className="flex gap-2">
									<div className="relative">
										<input
											type="text"
											placeholder="Search products..."
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											className="pl-9 pr-4 py-2 bg-white/10 text-white placeholder-gray-300 rounded-xl text-sm focus:outline-none focus:bg-white/20 transition-all"
										/>
										<span className="absolute left-3 top-2.5 text-gray-300 text-sm">
											🔍
										</span>
									</div>
									<select
										value={selectedCategory}
										onChange={(e) => setSelectedCategory(e.target.value)}
										className="px-3 py-2 bg-white/10 text-white rounded-xl text-sm focus:outline-none cursor-pointer">
										<option value="all">All Items</option>
										<option value="lowStock">Low Stock (&lt;5)</option>
										<option value="outOfStock">Out of Stock</option>
									</select>
								</div>
							</div>
						</div>

						<div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
							{filteredProducts.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 px-4">
									<div className="text-6xl mb-4 opacity-30">📦</div>
									<p className="text-gray-400 font-medium text-center">
										No products found
									</p>
									<p className="text-xs text-gray-300 text-center mt-1">
										{searchTerm
											? "Try a different search term"
											: "Start by adding your first product"}
									</p>
								</div>
							) : (
								<div className="divide-y divide-gray-100">
									{filteredProducts.map((item) => (
										<div
											key={item.id}
											className="p-5 hover:bg-gray-50 transition-all duration-200 group">
											<div className="flex justify-between items-start mb-3">
												<div className="flex-1">
													<div className="flex items-center gap-2 flex-wrap">
														<h4 className="font-bold text-gray-800 text-base">
															{item.name}
														</h4>
														<span
															className={`text-xs px-2 py-1 rounded-full font-semibold ${
																item.stock === 0
																	? "bg-red-100 text-red-700"
																	: item.stock < 5
																		? "bg-yellow-100 text-yellow-700"
																		: "bg-green-100 text-green-700"
															}`}>
															{item.stock === 0
																? "Out of Stock"
																: item.stock < 5
																	? "Low Stock"
																	: "In Stock"}
														</span>
													</div>
													<div className="flex items-center gap-3 mt-2 flex-wrap">
														{item.barcode && (
															<span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
																🔖 {item.barcode}
															</span>
														)}
														<span className="text-[10px] text-gray-400">
															📅 Added:{" "}
															{item.created_at
																? new Date(item.created_at).toLocaleDateString()
																: "N/A"}
														</span>
													</div>
												</div>
												<div className="text-right">
													<p className="text-2xl font-bold text-green-600">
														₱{Number(item.selling_price || 0).toFixed(2)}
													</p>
													<p className="text-xs text-gray-400 line-through">
														Cost: ₱{Number(item.cost_price || 0).toFixed(2)}
													</p>
												</div>
											</div>

											<div className="flex justify-between items-center">
												<div className="flex items-center gap-4">
													<div className="flex items-center gap-2">
														<span className="text-sm text-gray-600">
															Stock:
														</span>
														<span
															className={`font-bold text-lg ${
																item.stock === 0
																	? "text-red-600"
																	: item.stock < 5
																		? "text-yellow-600"
																		: "text-green-600"
															}`}>
															{item.stock}
														</span>
														<span className="text-xs text-gray-400">units</span>
													</div>
													<div className="text-xs text-gray-500">
														Profit: ₱
														{(
															(item.selling_price - (item.cost_price || 0)) *
															(item.stock || 0)
														).toFixed(2)}
													</div>
												</div>
												<div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
													<button
														onClick={() => startEdit(item)}
														className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
														✏️ Edit
													</button>
													<button
														onClick={() => deleteItem(item.id, item.name)}
														className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">
														🗑️ Delete
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Footer with quick tips */}
						<div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
							<p className="text-xs text-gray-500 text-center">
								💡 Tip: Click on a product to edit its details or use the search
								bar to find specific items
							</p>
						</div>
					</div>
				</section>
			</div>

			{/* Custom Scrollbar Styles */}
			<style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
		</div>
	);
}
