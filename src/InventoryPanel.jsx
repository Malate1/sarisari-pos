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
	const [loading, setLoading] = useState(false);
	const [imageFile, setImageFile] = useState(null);
	const [imagePreview, setImagePreview] = useState("");
	const getFileNameFromUrl = (url) => {
		if (!url) return null;
		return url.split("/").pop(); // gets filename
	};

	useEffect(() => {
		loadInventory();
	}, []);

	const loadInventory = async () => {
		try {
			setLoading(true);
			const { data, error } = await db
				.from("inventory")
				.select("*")
				.order("id", { ascending: false });

			if (error) {
				console.error(error);
				toast.error("Failed to load inventory", {
					duration: 3000,
					position: 'top-right',
				});
				return;
			}

			setInventoryList(data || []);
			toast.success(`Loaded ${data?.length || 0} products`, {
				duration: 2000,
				position: 'top-right',
				icon: '📦',
			});
		} catch (error) {
			console.error(error);
			toast.error("Error loading inventory", {
				duration: 3000,
				position: 'top-right',
			});
		} finally {
			setLoading(false);
		}
	};

	const processInventoryBarcode = async (code) => {
		try {
			console.log('Processing barcode:', code);
			
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
					setEditingId(null);
					setBarcode(code);
					setName('');
					setCost_price('');
					setSelling_price('');
					setStock('');
					
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
	let imageUrl = "";
	// Update barcode when initialBarcode prop changes
	useEffect(() => {
		if (initialBarcode) {
			setBarcode(initialBarcode);
		}
	}, [initialBarcode]);

	// Handle saving new products or updating existing items
	const handleSaveProduct = async (e) => {
		e.preventDefault();

		try {

			if (imageFile) {

				
				const fileName =
					Date.now() + "_" + imageFile.name.replace(/\s+/g, "_");

				const { error: uploadError } = await db.storage
					.from("product-images")
					.upload(fileName, imageFile);

				if (uploadError) throw uploadError;

				if (fileName) {
					const oldFile = getFileNameFromUrl(fileName);

					await db.storage
					.from("product-images")
					.remove([oldFile]);
				}

				const { data } = db.storage
					.from("product-images")
					.getPublicUrl(fileName);

				imageUrl = data.publicUrl;
			}


		} catch(error) {
			console.error(error);
		}
		
		if (!name || !selling_price) {
			Swal.fire({
				title: '⚠️ Missing Information',
				text: 'Product Name and Selling Price are required.',
				icon: 'warning',
				confirmButtonColor: '#f59e0b',
				confirmButtonText: 'OK',
			});
			return;
		}

		// Confirmation before saving
		const confirmResult = await Swal.fire({
			title: editingId ? '✏️ Update Product?' : '➕ Add New Product?',
			html: `
				<div class="text-left">
					<p><strong>Product:</strong> ${name}</p>
					<p><strong>Barcode:</strong> ${barcode || 'N/A'}</p>
					<p><strong>Selling Price:</strong> ₱${Number(selling_price).toFixed(2)}</p>
					<p><strong>Stock:</strong> ${Number(stock) || 0} units</p>
				</div>
			`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: editingId ? '#f59e0b' : '#3b82f6',
			cancelButtonColor: '#6b7280',
			confirmButtonText: editingId ? '✅ Yes, Update' : '✅ Yes, Add',
			cancelButtonText: '❌ No, Cancel',
		});

		if (!confirmResult.isConfirmed) {
			toast.info('Operation cancelled', {
				duration: 2000,
				position: 'top-right',
			});
			return;
		}

		try {
			if (editingId) {
				const { error } = await db
					.from("inventory")
					.update({
						name,
						barcode: barcode.trim() || null,
						cost_price: Number(cost_price) || 0,
						selling_price: Number(selling_price),
						stock: Number(stock) || 0,
  						image_url: imageUrl
					})
					.eq("id", editingId);

				if (error) throw error;

				await Swal.fire({
					title: '✅ Product Updated!',
					text: `"${name}" has been successfully updated.`,
					icon: 'success',
					timer: 2000,
					timerProgressBar: true,
					confirmButtonColor: '#10b981',
					confirmButtonText: 'OK',
				});

				toast.success(`Product "${name}" updated successfully! 🎉`, {
					duration: 3000,
					position: 'top-right',
				});

				setEditingId(null);
			} else {
				const { error } = await db.from("inventory").insert({
					name,
					barcode: barcode.trim() || null,
					cost_price: Number(cost_price) || 0,
					selling_price: Number(selling_price),
					stock: Number(stock) || 0,
    				image_url: imageUrl,
					created_at: new Date().toISOString()
				});

				if (error) throw error;

				await Swal.fire({
					title: '🎉 Product Added!',
					text: `"${name}" has been added to inventory.`,
					icon: 'success',
					timer: 2000,
					timerProgressBar: true,
					confirmButtonColor: '#10b981',
					confirmButtonText: 'OK',
				});

				toast.success(`Product "${name}" added successfully! 🎉`, {
					duration: 3000,
					position: 'top-right',
				});
			}

			// Clear form
			setName("");
			setBarcode("");
			setCost_price("");
			setSelling_price("");
			setStock("");
			setEditingId(null);

			await loadInventory();
		} catch (error) {
			console.error(error);
			
			await Swal.fire({
				title: '❌ Error!',
				text: error.message || 'Failed to save product. Please try again.',
				icon: 'error',
				confirmButtonColor: '#ef4444',
				confirmButtonText: 'OK',
			});

			toast.error(`Failed to save: ${error.message}`, {
				duration: 3000,
				position: 'top-right',
			});
		}
	};

	// Populate data inputs into form fields for correction editing
	const startEdit = (item) => {
		Swal.fire({
			title: '✏️ Edit Product',
			text: `Are you sure you want to edit "${item.name}"?`,
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#f59e0b',
			cancelButtonColor: '#6b7280',
			confirmButtonText: '✅ Yes, Edit',
			cancelButtonText: '❌ No, Cancel',
		}).then((result) => {
			if (result.isConfirmed) {
				setEditingId(item.id);
				setName(item.name);
				setBarcode(item.barcode || "");
				setCost_price(item.cost_price);
				setSelling_price(item.selling_price);
				setStock(item.stock);
				setImagePreview(item.image_url || "");
				setImageFile(null);
				
				toast.info(`Editing "${item.name}"`, {
					duration: 2000,
					position: 'top-right',
				});
				
				document
					.getElementById("product-form")
					?.scrollIntoView({ behavior: "smooth" });
			} else {
				toast.info('Edit cancelled', {
					duration: 2000,
					position: 'top-right',
				});
			}
		});
	};

	// Delete product entry from IndexedDB permanently
	const deleteItem = async (id, productName) => {
		const result = await Swal.fire({
			title: '🗑️ Delete Product?',
			html: `
				<div class="text-left">
					<p>Are you sure you want to delete <strong>"${productName}"</strong>?</p>
					<p class="text-sm text-red-500 mt-2">⚠️ This action cannot be undone!</p>
				</div>
			`,
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#ef4444',
			cancelButtonColor: '#6b7280',
			confirmButtonText: '🗑️ Yes, Delete',
			cancelButtonText: '❌ No, Cancel',
		});

		if (!result.isConfirmed) {
			toast.info('Deletion cancelled', {
				duration: 2000,
				position: 'top-right',
			});
			return;
		}

		try {
			const { error } = await db.from("inventory").delete().eq("id", id);

			if (error) throw error;

			if (imageUrl) {
				const fileName = getFileNameFromUrl(imageUrl);

				await db.storage
					.from("product-images")
					.remove([fileName]);
			}

			await Swal.fire({
				title: '🗑️ Product Deleted!',
				text: `"${productName}" has been removed from inventory.`,
				icon: 'success',
				timer: 2000,
				timerProgressBar: true,
				confirmButtonColor: '#10b981',
				confirmButtonText: 'OK',
			});

			toast.success(`Product "${productName}" deleted successfully!`, {
				duration: 3000,
				position: 'top-right',
			});

			await loadInventory();
		} catch (error) {
			console.error(error);
			
			await Swal.fire({
				title: '❌ Error!',
				text: error.message || 'Failed to delete product. Please try again.',
				icon: 'error',
				confirmButtonColor: '#ef4444',
				confirmButtonText: 'OK',
			});

			toast.error(`Failed to delete: ${error.message}`, {
				duration: 3000,
				position: 'top-right',
			});
		}
	};

	// Clear form confirmation
	const clearForm = async () => {
		if (name || barcode || cost_price || selling_price || stock) {
			const result = await Swal.fire({
				title: '🧹 Clear Form?',
				text: 'All form data will be cleared. Are you sure?',
				icon: 'question',
				showCancelButton: true,
				confirmButtonColor: '#6b7280',
				cancelButtonColor: '#ef4444',
				confirmButtonText: '✅ Yes, Clear',
				cancelButtonText: '❌ No, Keep',
			});

			if (!result.isConfirmed) {
				toast.info('Form clear cancelled', {
					duration: 2000,
					position: 'top-right',
				});
				return;
			}
		}

		setEditingId(null);
		setName("");
		setBarcode("");
		setCost_price("");
		setSelling_price("");
		setStock("");
		setImageFile(null);
		setImagePreview("");
		
		toast.info('Form cleared', {
			duration: 2000,
			position: 'top-right',
		});
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
					? item.stock < 5 && item.stock > 0
					: selectedCategory === "outOfStock"
						? item.stock === 0
						: selectedCategory === "inStock"
							? item.stock > 0
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
			{/* Toast Container */}
			<Toaster
				position="top-right"
				toastOptions={{
					duration: 3000,
					style: {
						background: '#363636',
						color: '#fff',
					},
					success: {
						duration: 2000,
						iconTheme: {
							primary: '#10b981',
							secondary: '#fff',
						},
					},
					error: {
						duration: 3000,
						iconTheme: {
							primary: '#ef4444',
							secondary: '#fff',
						},
					},
				}}
			/>

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
									Product Photo
								</label>

								<input
									type="file"
									accept="image/*"
									onChange={(e) => {
									const file = e.target.files[0];

									if (file) {
										setImageFile(file);
										setImagePreview(URL.createObjectURL(file));
									}
									}}
									className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl"
								/>

								{imagePreview && (
									<div className="mt-3">
									<img
										src={imagePreview}
										alt="Preview"
										className="w-32 h-32 object-cover rounded-xl border"
									/>
									</div>
								)}
							</div>

							<div>
								<label className="block text-xs font-bold text-gray-600 uppercase mb-2">
									Product Name <span className="font-googlesans text-red-500">*</span>
								</label>
								<input
									id="product-name"
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
								<div className="flex gap-2">
									<div className="flex-1 relative">
										<span className="absolute left-3 top-3.5 text-gray-400">
											🔖
										</span>
										<input
											type="text"
											value={barcode}
											onChange={(e) => setBarcode(e.target.value)}
											onKeyDown={handleBarcodeSubmit}
											placeholder="Scan or enter barcode"
											className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-all duration-200 font-mono text-sm"
										/>
									</div>
									<button
										type="button"
										onClick={() => setShowScanner(!showScanner)}
										className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 whitespace-nowrap ${
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
										onClick={clearForm}
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
							{loading ? (
								<div className="flex items-center justify-center py-16">
									<div className="text-center">
										<div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
										<p className="text-gray-500">Loading inventory...</p>
									</div>
								</div>
							) : filteredProducts.length === 0 ? (
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
											<div className="flex justify-between items-start gap-4 mb-3">
  												<div className="flex gap-4 flex-1">
												
													<img
														src={item.image_url || "/no-image.png"}
														alt={item.name}
														className="w-20 h-20 object-cover rounded-xl border shadow-sm"
														/>
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
												<div className="flex gap-2">
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
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
		</div>
	);
}