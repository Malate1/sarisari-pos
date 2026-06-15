// src/ReportsPanel.jsx - Added Reorder Report
import React, { useState, useEffect } from "react";
import { db } from "./db";

export default function ReportsPanel({ onClose }) {
	const [activeTab, setActiveTab] = useState("sales");
	const [dateRange, setDateRange] = useState("today");
	const [startDate, setStartDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [endDate, setEndDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [showExportOptions, setShowExportOptions] = useState(false);
	const [reorderThreshold, setReorderThreshold] = useState(7); // Days of stock to trigger reorder
	const [suggestedOrder, setSuggestedOrder] = useState([]);

	// Fetch data
	const [sales, setSales] = useState([]);
	const [saleItems, setSaleItems] = useState([]);
	const [inventory, setInventory] = useState([]);
	const [creditLogs, setCreditLogs] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		try {
			setLoading(true);

			const [salesRes, saleItemsRes, inventoryRes, creditRes] =
				await Promise.all([
					db.from("sales").select("*").order("created_at", { ascending: false }),

					db.from("sale_items").select("*"),

					db.from("inventory").select("*"),

					db.from("credit_logs").select("*"),
				]);

			if (salesRes.error) throw salesRes.error;
			if (saleItemsRes.error) throw saleItemsRes.error;
			if (inventoryRes.error) throw inventoryRes.error;
			if (creditRes.error) throw creditRes.error;

			setSales(salesRes.data || []);
			setSaleItems(saleItemsRes.data || []);
			setInventory(inventoryRes.data || []);
			setCreditLogs(creditRes.data || []);
		} catch (err) {
			console.error("Failed loading reports:", err);
		} finally {
			setLoading(false);
		}
	};

	// Calculate daily sales average for each product
	const calculateDailySalesAverage = () => {
		const dailySalesMap = {};
		const last30DaysSales = sales.filter((sale) => {
			const saleDate = new Date(sale.created_at);
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
			return saleDate >= thirtyDaysAgo;
		});

		// Count unique days with sales
		const uniqueDays = new Set();
		last30DaysSales.forEach((sale) => {
			const date = new Date(sale.created_at).toISOString().split("T")[0];
			uniqueDays.add(date);
		});
		const numberOfDays = Math.max(uniqueDays.size, 1);

		// Calculate total sales per product in last 30 days
		const productSales30Days = {};
		last30DaysSales.forEach((sale) => {
			const items = saleItems.filter((item) => item.sale_id === sale.id);
			items.forEach((item) => {
				if (!productSales30Days[item.product_id]) {
					productSales30Days[item.product_id] = 0;
				}
				productSales30Days[item.product_id] += item.quantity || 0;
			});
		});

		// Calculate daily average
		const dailyAverages = {};
		Object.keys(productSales30Days).forEach((product_id) => {
			dailyAverages[product_id] = productSales30Days[product_id] / numberOfDays;
		});

		return dailyAverages;
	};

	// Generate reorder suggestions
	const generateReorderSuggestions = () => {
		const dailyAverages = calculateDailySalesAverage();
		const suggestions = [];

		inventory.forEach((product) => {
			const currentStock = product.stock || 0;
			const avgDailySales = dailyAverages[product.id] || 0;

			if (avgDailySales > 0) {
				// Calculate days of stock remaining
				const daysOfStock = currentStock / avgDailySales;

				// Calculate suggested reorder quantity based on:
				// - Desired days of coverage (reorderThreshold + 7 days safety stock)
				const desiredDays = reorderThreshold + 7;
				const suggestedQuantity =
					Math.ceil(avgDailySales * desiredDays) - currentStock;

				// Only suggest if days of stock is below threshold
				if (daysOfStock <= reorderThreshold && suggestedQuantity > 0) {
					let priority = "medium";
					let urgencyMessage = "";

					if (daysOfStock <= 2) {
						priority = "critical";
						urgencyMessage = "⚠️ CRITICAL - Will run out in 1-2 days!";
					} else if (daysOfStock <= 5) {
						priority = "high";
						urgencyMessage = "🔴 HIGH - Low stock, reorder immediately";
					} else if (daysOfStock <= 10) {
						priority = "medium";
						urgencyMessage = "🟡 MEDIUM - Stock running low, plan reorder";
					} else if (daysOfStock <= 15) {
						priority = "low";
						urgencyMessage = "🟢 LOW - Consider reordering soon";
					}

					suggestions.push({
						id: product.id,
						name: product.name,
						barcode: product.barcode,
						currentStock: currentStock,
						avgDailySales: avgDailySales.toFixed(1),
						daysOfStock: daysOfStock.toFixed(1),
						suggestedQuantity: suggestedQuantity,
						estimatedCost: suggestedQuantity * (product.cost_price || 0),
						priority: priority,
						urgencyMessage: urgencyMessage,
						selling_priceupdate: product.selling_priceupdate,
						cost_price: product.cost_price,
					});
				}
			} else if (currentStock === 0) {
				// Out of stock but no sales data - suggest minimum order
				suggestions.push({
					id: product.id,
					name: product.name,
					barcode: product.barcode,
					currentStock: 0,
					avgDailySales: 0,
					daysOfStock: 0,
					suggestedQuantity: 10, // Default minimum order
					estimatedCost: 10 * (product.cost_price || 0),
					priority: "unknown",
					urgencyMessage:
						"❓ OUT OF STOCK - No recent sales data, consider ordering minimum quantity",
					selling_priceupdate: product.selling_priceupdate,
					cost_price: product.cost_price,
				});
			}
		});

		// Sort by priority: critical > high > medium > low > unknown
		const priorityOrder = {
			critical: 0,
			high: 1,
			medium: 2,
			low: 3,
			unknown: 4,
		};
		suggestions.sort(
			(a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
		);

		setSuggestedOrder(suggestions);
	};

	// Generate reorder suggestions when dependencies change
	useEffect(() => {
		generateReorderSuggestions();
	}, [reorderThreshold, sales, saleItems, inventory]);

	// Filter sales by date range
	const getFilteredSales = () => {
		let filtered = [...sales];

		if (dateRange === "today") {
			const today = new Date().toISOString().split("T")[0];
			filtered = sales.filter(
				(sale) =>
					new Date(sale.created_at).toISOString().split("T")[0] === today,
			);
		} else if (dateRange === "week") {
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			filtered = sales.filter((sale) => sale.created_at >= weekAgo.getTime());
		} else if (dateRange === "month") {
			const monthAgo = new Date();
			monthAgo.setMonth(monthAgo.getMonth() - 1);
			filtered = sales.filter((sale) => sale.created_at >= monthAgo.getTime());
		} else if (dateRange === "custom" && startDate && endDate) {
			const start = new Date(startDate).setHours(0, 0, 0, 0);
			const end = new Date(endDate).setHours(23, 59, 59, 999);
			filtered = sales.filter(
				(sale) => sale.created_at >= start && sale.created_at <= end,
			);
		}

		return filtered;
	};

	const filteredSales = getFilteredSales();

	// Calculate sales statistics
	const totalSales = filteredSales.reduce(
		(sum, sale) => sum + (sale.total || 0),
		0,
	);
	const totalTransactions = filteredSales.length;
	const averageTransaction =
		totalTransactions > 0 ? totalSales / totalTransactions : 0;

	// Top selling products calculation
	const productSales = {};

	filteredSales.forEach((sale) => {
		const items = saleItems.filter((item) => item.sale_id === sale.id);
		items.forEach((item) => {
			const product_id = item.product_id;
			if (!productSales[product_id]) {
				const product = inventory.find((p) => p.id === product_id);
				productSales[product_id] = {
					name: product?.name || item.product_name || "Unknown Product",
					quantity: 0,
					revenue: 0,
				};
			}
			const subtotal = item.subtotal || item.quantity * (item.price || 0);
			productSales[product_id].quantity += item.quantity || 0;
			productSales[product_id].revenue += subtotal || 0;
		});
	});

	const topProducts = Object.values(productSales)
		.sort((a, b) => b.revenue - a.revenue)
		.slice(0, 10);

	// Daily sales data
	const dailySales = {};
	filteredSales.forEach((sale) => {
		const date = new Date(sale.created_at).toISOString().split("T")[0];
		if (!dailySales[date]) {
			dailySales[date] = { total: 0, count: 0 };
		}
		dailySales[date].total += sale.total || 0;
		dailySales[date].count += 1;
	});

	// Inventory statistics
	const lowStockItems = inventory.filter(
		(item) => item.stock <= 5 && item.stock > 0,
	);
	const outOfStockItems = inventory.filter((item) => item.stock === 0);
	const totalInventoryValue = inventory.reduce(
		(sum, item) => sum + (item.cost_price || 0) * (item.stock || 0),
		0,
	);
	const totalRetailValue = inventory.reduce(
		(sum, item) => sum + (item.selling_priceupdate || 0) * (item.stock || 0),
		0,
	);
	const potentialProfit = totalRetailValue - totalInventoryValue;

	// Credit statistics
	const totalCreditAmount = creditLogs.reduce(
		(sum, credit) => sum + (credit.amount || 0),
		0,
	);
	const totalPaidAmount = creditLogs.reduce(
		(sum, credit) => sum + (credit.paidAmount || 0),
		0,
	);
	const totalPendingAmount = totalCreditAmount - totalPaidAmount;
	const overdueCredits = creditLogs.filter(
		(credit) =>
			credit.status !== "paid" &&
			credit.dueDate &&
			new Date(credit.dueDate) < new Date(),
	).length;

	// Export to CSV
	const exportToCSV = (type) => {
		let data = [];
		let filename = "";

		if (type === "sales") {
			data = filteredSales.map((sale) => ({
				Date: new Date(sale.created_at).toLocaleString(),
				"Sale ID": sale.id,
				Total: sale.total?.toFixed(2) || "0.00",
				"Cash Received": sale.cashReceived?.toFixed(2) || "0.00",
				Change: sale.changeDue?.toFixed(2) || "0.00",
			}));
			filename = `sales_report_${new Date().toISOString().split("T")[0]}.csv`;
		} else if (type === "inventory") {
			data = inventory.map((item) => ({
				"Product Name": item.name,
				Barcode: item.barcode || "N/A",
				"Cost Price": item.cost_price?.toFixed(2) || "0.00",
				"Selling Price": item.selling_priceupdate?.toFixed(2) || "0.00",
				Stock: item.stock || 0,
				"Total Value": ((item.cost_price || 0) * (item.stock || 0)).toFixed(2),
			}));
			filename = `inventory_report_${new Date().toISOString().split("T")[0]}.csv`;
		} else if (type === "reorder") {
			data = suggestedOrder.map((item) => ({
				"Product Name": item.name,
				"Current Stock": item.currentStock,
				"Daily Sales Avg": item.avgDailySales,
				"Days of Stock": item.daysOfStock,
				"Suggested Order": item.suggestedQuantity,
				"Estimated Cost": item.estimatedCost.toFixed(2),
				Priority: item.priority.toUpperCase(),
				Urgency: item.urgencyMessage,
			}));
			filename = `reorder_report_${new Date().toISOString().split("T")[0]}.csv`;
		}

		if (data.length === 0) {
			alert("No data to export");
			return;
		}

		const headers = Object.keys(data[0]);
		const csvRows = [];
		csvRows.push(headers.join(","));

		for (const row of data) {
			const values = headers.map((header) => {
				const value = row[header];
				return `"${value}"`;
			});
			csvRows.push(values.join(","));
		}

		const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	};

	const printReport = () => {
		window.print();
	};

	// Calculate summary for reorder report
	const totalReorderCost = suggestedOrder.reduce(
		(sum, item) => sum + item.estimatedCost,
		0,
	);
	const criticalItems = suggestedOrder.filter(
		(item) => item.priority === "critical",
	).length;
	const highPriorityItems = suggestedOrder.filter(
		(item) => item.priority === "high",
	).length;

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
			<div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
					<div className="flex justify-between items-center">
						<div>
							<h2 className="text-white font-bold text-xl flex items-center gap-2">
								📊 Reports & Analytics
							</h2>
							<p className="text-white/80 text-sm mt-1">
								Monitor sales, inventory, and credit performance
							</p>
						</div>
						<div className="flex gap-2 relative">
							<button
								onClick={() => setShowExportOptions(!showExportOptions)}
								className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition">
								📥 Export
							</button>
							<button
								onClick={printReport}
								className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition">
								🖨️ Print
							</button>
							<button
								onClick={onClose}
								className="text-white/80 hover:text-white text-2xl leading-none transition-colors">
								✕
							</button>

							{/* Export Options Dropdown */}
							{showExportOptions && (
								<div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 min-w-[180px]">
									<button
										onClick={() => {
											exportToCSV("sales");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
										📊 Export Sales Report
									</button>
									<button
										onClick={() => {
											exportToCSV("inventory");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">
										📦 Export Inventory Report
									</button>
									<button
										onClick={() => {
											exportToCSV("reorder");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2 hover:bg-gray-50 rounded-b-xl text-sm">
										📋 Export Reorder Report
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-gray-200 px-6 overflow-x-auto">
					<button
						onClick={() => setActiveTab("sales")}
						className={`px-4 py-3 font-semibold transition whitespace-nowrap ${
							activeTab === "sales"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}>
						💰 Sales Report
					</button>
					<button
						onClick={() => setActiveTab("reorder")}
						className={`px-4 py-3 font-semibold transition whitespace-nowrap ${
							activeTab === "reorder"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}>
						📋 Reorder Report
					</button>
					<button
						onClick={() => setActiveTab("inventory")}
						className={`px-4 py-3 font-semibold transition whitespace-nowrap ${
							activeTab === "inventory"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}>
						📦 Inventory Report
					</button>
					<button
						onClick={() => setActiveTab("credits")}
						className={`px-4 py-3 font-semibold transition whitespace-nowrap ${
							activeTab === "credits"
								? "text-blue-600 border-b-2 border-blue-600"
								: "text-gray-500 hover:text-gray-700"
						}`}>
						📝 Credit Report
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
					{/* REORDER REPORT */}
					{activeTab === "reorder" && (
						<div className="space-y-6">
							{/* Settings */}
							<div className="bg-gray-50 rounded-xl p-4">
								<div className="flex flex-wrap gap-4 items-center justify-between">
									<div className="flex items-center gap-3">
										<span className="font-semibold text-gray-700">
											Reorder Alert Threshold:
										</span>
										<div className="flex items-center gap-2">
											<input
												type="range"
												min="3"
												max="30"
												value={reorderThreshold}
												onChange={(e) =>
													setReorderThreshold(parseInt(e.target.value))
												}
												className="w-48"
											/>
											<span className="font-bold text-blue-600 min-w-[60px]">
												{reorderThreshold} days
											</span>
										</div>
									</div>
									<div className="text-sm text-gray-500">
										💡 Items with less than {reorderThreshold} days of stock
										will appear here
									</div>
								</div>
							</div>

							{/* Summary Cards */}
							<div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
								<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
									<p className="text-red-100 text-sm">Critical Items</p>
									<p className="text-2xl font-bold mt-1">{criticalItems}</p>
									<p className="text-xs text-red-100 mt-1">
										Will run out in 1-2 days
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
									<p className="text-orange-100 text-sm">High Priority</p>
									<p className="text-2xl font-bold mt-1">{highPriorityItems}</p>
									<p className="text-xs text-orange-100 mt-1">
										Low stock, reorder soon
									</p>
								</div>
								<div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 text-white">
									<p className="text-yellow-100 text-sm">
										Total Items to Reorder
									</p>
									<p className="text-2xl font-bold mt-1">
										{suggestedOrder.length}
									</p>
									<p className="text-xs text-yellow-100 mt-1">
										Products needing restock
									</p>
								</div>
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
									<p className="text-blue-100 text-sm">
										Estimated Reorder Cost
									</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalReorderCost.toFixed(2)}
									</p>
									<p className="text-xs text-blue-100 mt-1">
										Based on suggested quantities
									</p>
								</div>
							</div>

							{/* Reorder List */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
									📋 Suggested Reorder List
									<span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
										Based on 30-day sales trend
									</span>
								</h3>

								{suggestedOrder.length === 0 ? (
									<div className="text-center py-12">
										<div className="text-5xl mb-3">✅</div>
										<p className="text-gray-500 font-medium">
											No items need reordering at this time
										</p>
										<p className="text-xs text-gray-400 mt-1">
											All products have sufficient stock levels
										</p>
									</div>
								) : (
									<div className="space-y-4">
										{suggestedOrder.map((item, idx) => (
											<div
												key={item.id}
												className={`border-2 rounded-xl p-4 transition-all ${
													item.priority === "critical"
														? "border-red-300 bg-red-50"
														: item.priority === "high"
															? "border-orange-300 bg-orange-50"
															: item.priority === "medium"
																? "border-yellow-300 bg-yellow-50"
																: "border-gray-200 bg-white"
												}`}>
												<div className="flex justify-between items-start mb-3">
													<div className="flex-1">
														<div className="flex items-center gap-2 flex-wrap">
															<h4 className="font-bold text-gray-800 text-lg">
																{item.name}
															</h4>
															<span
																className={`px-2 py-1 rounded-full text-xs font-semibold ${
																	item.priority === "critical"
																		? "bg-red-200 text-red-800"
																		: item.priority === "high"
																			? "bg-orange-200 text-orange-800"
																			: item.priority === "medium"
																				? "bg-yellow-200 text-yellow-800"
																				: "bg-gray-200 text-gray-700"
																}`}>
																{item.priority.toUpperCase()} PRIORITY
															</span>
														</div>
														<p className="text-sm text-red-600 font-medium mt-1">
															{item.urgencyMessage}
														</p>
														{item.barcode && (
															<p className="text-xs text-gray-500 font-mono mt-1">
																🔖 {item.barcode}
															</p>
														)}
													</div>
													<div className="text-right">
														<p className="text-xs text-gray-500">
															Est. Reorder Cost
														</p>
														<p className="text-xl font-bold text-blue-600">
															₱{item.estimatedCost.toFixed(2)}
														</p>
													</div>
												</div>

												<div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-3">
													<div>
														<p className="text-xs text-gray-500">
															Current Stock
														</p>
														<p
															className={`font-bold text-lg ${item.currentStock === 0 ? "text-red-600" : "text-gray-800"}`}>
															{item.currentStock} units
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-500">
															Daily Sales Avg
														</p>
														<p className="font-semibold text-gray-800">
															{item.avgDailySales} units/day
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-500">
															Days of Stock Left
														</p>
														<p
															className={`font-bold ${
																item.daysOfStock <= 2
																	? "text-red-600"
																	: item.daysOfStock <= 5
																		? "text-orange-600"
																		: "text-yellow-600"
															}`}>
															{item.daysOfStock} days
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-500">
															Suggested Order
														</p>
														<p className="font-bold text-green-600">
															{item.suggestedQuantity} units
														</p>
													</div>
													<div>
														<p className="text-xs text-gray-500">
															Cost per Unit
														</p>
														<p className="text-gray-700">
															₱{(item.cost_price || 0).toFixed(2)}
														</p>
													</div>
												</div>

												{/* Progress bar for stock level */}
												<div className="mt-3">
													<div className="flex justify-between text-xs mb-1">
														<span>Stock Level</span>
														<span>
															{Math.min(
																(item.currentStock /
																	(item.suggestedQuantity +
																		item.currentStock)) *
																	100,
																100,
															).toFixed(0)}
															%
														</span>
													</div>
													<div className="w-full bg-gray-200 rounded-full h-2">
														<div
															className={`rounded-full h-2 transition-all ${
																item.priority === "critical"
																	? "bg-red-500"
																	: item.priority === "high"
																		? "bg-orange-500"
																		: "bg-yellow-500"
															}`}
															style={{
																width: `${Math.min((item.currentStock / (item.suggestedQuantity + item.currentStock)) * 100, 100)}%`,
															}}
														/>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Reorder Summary Table */}
							{suggestedOrder.length > 0 && (
								<div className="bg-white rounded-xl border border-gray-200 p-4">
									<h3 className="font-bold text-gray-800 mb-3">
										📊 Reorder Summary
									</h3>
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead className="border-b">
												<tr>
													<th className="text-left py-2">Product</th>
													<th className="text-right py-2">Current Stock</th>
													<th className="text-right py-2">Daily Avg</th>
													<th className="text-right py-2">Days Left</th>
													<th className="text-right py-2">Suggested</th>
													<th className="text-right py-2">Est. Cost</th>
												</tr>
											</thead>
											<tbody>
												{suggestedOrder.map((item) => (
													<tr
														key={item.id}
														className="border-b border-gray-100">
														<td className="py-2 font-medium">{item.name}</td>
														<td className="py-2 text-right">
															{item.currentStock}
														</td>
														<td className="py-2 text-right">
															{item.avgDailySales}
														</td>
														<td
															className={`py-2 text-right font-semibold ${
																item.daysOfStock <= 2
																	? "text-red-600"
																	: item.daysOfStock <= 5
																		? "text-orange-600"
																		: "text-yellow-600"
															}`}>
															{item.daysOfStock}
														</td>
														<td className="py-2 text-right font-semibold text-green-600">
															{item.suggestedQuantity}
														</td>
														<td className="py-2 text-right">
															₱{item.estimatedCost.toFixed(2)}
														</td>
													</tr>
												))}
												<tr className="bg-gray-50 font-bold">
													<td colSpan="4" className="py-2 text-right">
														Total Estimated Cost:
													</td>
													<td className="py-2 text-right text-blue-600">
														₱{totalReorderCost.toFixed(2)}
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>
					)}

					{/* SALES REPORT */}
					{activeTab === "sales" && (
						<div className="space-y-6">
							{/* Date Filter */}
							<div className="bg-gray-50 rounded-xl p-4">
								<div className="flex flex-wrap gap-4 items-center">
									<span className="font-semibold text-gray-700">
										Date Range:
									</span>
									<div className="flex gap-2 flex-wrap">
										{["today", "week", "month", "custom"].map((range) => (
											<button
												key={range}
												onClick={() => setDateRange(range)}
												className={`px-3 py-1 rounded-lg text-sm capitalize transition ${
													dateRange === range
														? "bg-blue-600 text-white"
														: "bg-white text-gray-600 hover:bg-gray-100"
												}`}>
												{range === "today"
													? "Today"
													: range === "week"
														? "This Week"
														: range === "month"
															? "This Month"
															: "Custom"}
											</button>
										))}
									</div>
									{dateRange === "custom" && (
										<div className="flex gap-2 items-center">
											<input
												type="date"
												value={startDate}
												onChange={(e) => setStartDate(e.target.value)}
												className="px-3 py-1 border rounded-lg text-sm"
											/>
											<span>to</span>
											<input
												type="date"
												value={endDate}
												onChange={(e) => setEndDate(e.target.value)}
												className="px-3 py-1 border rounded-lg text-sm"
											/>
										</div>
									)}
								</div>
							</div>

							{/* Key Metrics */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
									<p className="text-green-100 text-sm">Total Sales</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalSales.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
									<p className="text-blue-100 text-sm">Transactions</p>
									<p className="text-2xl font-bold mt-1">{totalTransactions}</p>
								</div>
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
									<p className="text-purple-100 text-sm">Average Transaction</p>
									<p className="text-2xl font-bold mt-1">
										₱{averageTransaction.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
									<p className="text-orange-100 text-sm">Daily Average</p>
									<p className="text-2xl font-bold mt-1">
										₱
										{(
											totalSales / Math.max(Object.keys(dailySales).length, 1)
										).toFixed(2)}
									</p>
								</div>
							</div>

							{/* Daily Sales Trend */}
							{Object.keys(dailySales).length > 0 && (
								<div className="bg-white rounded-xl border border-gray-200 p-4">
									<h3 className="font-bold text-gray-800 mb-3">
										📈 Daily Sales Trend
									</h3>
									<div className="space-y-2">
										{Object.entries(dailySales)
											.slice(-7)
											.reverse()
											.map(([date, data]) => (
												<div key={date}>
													<div className="flex justify-between text-sm mb-1">
														<span className="text-gray-600">
															{new Date(date).toLocaleDateString()}
														</span>
														<span className="font-semibold">
															₱{data.total.toFixed(2)}
														</span>
													</div>
													<div className="w-full bg-gray-200 rounded-full h-2">
														<div
															className="bg-green-500 rounded-full h-2 transition-all"
															style={{
																width: `${Math.min((data.total / totalSales) * 100, 100)}%`,
															}}
														/>
													</div>
												</div>
											))}
									</div>
								</div>
							)}

							{/* Top Selling Products */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3">
									🏆 Top Selling Products
								</h3>
								{topProducts.length === 0 ? (
									<p className="text-center text-gray-500 py-8">
										No sales data available for the selected period
									</p>
								) : (
									<div className="space-y-3">
										{topProducts.map((product, idx) => (
											<div
												key={idx}
												className="flex justify-between items-center">
												<div className="flex items-center gap-3">
													<span className="text-2xl">
														{idx === 0
															? "🥇"
															: idx === 1
																? "🥈"
																: idx === 2
																	? "🥉"
																	: "📦"}
													</span>
													<div>
														<p className="font-semibold text-gray-800">
															{product.name}
														</p>
														<p className="text-xs text-gray-500">
															{product.quantity} units sold
														</p>
													</div>
												</div>
												<p className="font-bold text-green-600">
													₱{(product.revenue || 0).toFixed(2)}
												</p>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Recent Transactions */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3">
									🕒 Recent Transactions
								</h3>
								{filteredSales.length === 0 ? (
									<p className="text-center text-gray-500 py-8">
										No transactions found for the selected period
									</p>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead className="border-b">
												<tr>
													<th className="text-left py-2">Date</th>
													<th className="text-left py-2">Sale ID</th>
													<th className="text-right py-2">Total</th>
												</tr>
											</thead>
											<tbody>
												{filteredSales.slice(0, 10).map((sale) => (
													<tr
														key={sale.id}
														className="border-b border-gray-100">
														<td className="py-2">
															{new Date(sale.created_at).toLocaleString()}
														</td>
														<td className="py-2">#{sale.id}</td>
														<td className="py-2 text-right font-semibold">
															₱{(sale.total || 0).toFixed(2)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					)}

					{/* INVENTORY REPORT */}
					{activeTab === "inventory" && (
						<div className="space-y-6">
							{/* Key Metrics */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
									<p className="text-blue-100 text-sm">Total Products</p>
									<p className="text-2xl font-bold mt-1">{inventory.length}</p>
								</div>
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
									<p className="text-green-100 text-sm">
										Inventory Value (Cost)
									</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalInventoryValue.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
									<p className="text-purple-100 text-sm">Retail Value</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalRetailValue.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
									<p className="text-orange-100 text-sm">Potential Profit</p>
									<p className="text-2xl font-bold mt-1">
										₱{potentialProfit.toFixed(2)}
									</p>
								</div>
							</div>

							{/* Stock Alerts */}
							{(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
								<div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-4">
									<h3 className="font-bold text-yellow-800 mb-2">
										⚠️ Stock Alerts
									</h3>
									{lowStockItems.length > 0 && (
										<p className="text-sm text-yellow-700">
											• {lowStockItems.length} product(s) running low on stock
											(&lt;5 units)
										</p>
									)}
									{outOfStockItems.length > 0 && (
										<p className="text-sm text-red-700">
											• {outOfStockItems.length} product(s) out of stock
										</p>
									)}
								</div>
							)}

							{/* Stock Distribution */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3">
									📊 Stock Distribution
								</h3>
								<div className="space-y-2">
									<div>
										<div className="flex justify-between text-sm mb-1">
											<span>In Stock (&gt;5)</span>
											<span>
												{inventory.filter((i) => i.stock > 5).length} products
											</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-2">
											<div
												className="bg-green-500 rounded-full h-2"
												style={{
													width: `${(inventory.filter((i) => i.stock > 5).length / inventory.length) * 100}%`,
												}}
											/>
										</div>
									</div>
									<div>
										<div className="flex justify-between text-sm mb-1">
											<span>Low Stock (1-5)</span>
											<span>{lowStockItems.length} products</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-2">
											<div
												className="bg-yellow-500 rounded-full h-2"
												style={{
													width: `${(lowStockItems.length / inventory.length) * 100}%`,
												}}
											/>
										</div>
									</div>
									<div>
										<div className="flex justify-between text-sm mb-1">
											<span>Out of Stock</span>
											<span>{outOfStockItems.length} products</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-2">
											<div
												className="bg-red-500 rounded-full h-2"
												style={{
													width: `${(outOfStockItems.length / inventory.length) * 100}%`,
												}}
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Complete Inventory List */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3">
									📋 Complete Inventory
								</h3>
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="border-b">
											<tr>
												<th className="text-left py-2">Product</th>
												<th className="text-left py-2">Barcode</th>
												<th className="text-right py-2">Cost</th>
												<th className="text-right py-2">Selling</th>
												<th className="text-right py-2">Stock</th>
												<th className="text-right py-2">Total Value</th>
											</tr>
										</thead>
										<tbody>
											{inventory.map((item) => (
												<tr key={item.id} className="border-b border-gray-100">
													<td className="py-2 font-medium">{item.name}</td>
													<td className="py-2 text-xs font-mono">
														{item.barcode || "N/A"}
													</td>
													<td className="py-2 text-right">
														₱{(item.cost_price || 0).toFixed(2)}
													</td>
													<td className="py-2 text-right">
														₱{(item.selling_priceupdate || 0).toFixed(2)}
													</td>
													<td
														className={`py-2 text-right font-semibold ${item.stock === 0 ? "text-red-600" : item.stock < 5 ? "text-yellow-600" : "text-green-600"}`}>
														{item.stock || 0}
													</td>
													<td className="py-2 text-right">
														₱
														{(
															(item.cost_price || 0) * (item.stock || 0)
														).toFixed(2)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					)}

					{/* CREDIT REPORT */}
					{activeTab === "credits" && (
						<div className="space-y-6">
							{/* Key Metrics */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
									<p className="text-purple-100 text-sm">Total Credits</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalCreditAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
									<p className="text-green-100 text-sm">Total Paid</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalPaidAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
									<p className="text-red-100 text-sm">Pending Balance</p>
									<p className="text-2xl font-bold mt-1">
										₱{totalPendingAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
									<p className="text-orange-100 text-sm">Overdue</p>
									<p className="text-2xl font-bold mt-1">{overdueCredits}</p>
								</div>
							</div>

							{/* Collection Rate */}
							{totalCreditAmount > 0 && (
								<div className="bg-white rounded-xl border border-gray-200 p-4">
									<h3 className="font-bold text-gray-800 mb-3">
										📊 Collection Rate
									</h3>
									<div className="flex flex-col sm:flex-row items-center gap-6">
										<div className="relative w-32 h-32">
											<svg className="w-32 h-32 transform -rotate-90">
												<circle
													cx="64"
													cy="64"
													r="56"
													stroke="#e5e7eb"
													strokeWidth="12"
													fill="none"
												/>
												<circle
													cx="64"
													cy="64"
													r="56"
													stroke="#10b981"
													strokeWidth="12"
													fill="none"
													strokeDasharray={`${(totalPaidAmount / totalCreditAmount) * 352} 352`}
													strokeLinecap="round"
												/>
											</svg>
											<div className="absolute inset-0 flex items-center justify-center">
												<p className="text-2xl font-bold text-green-600">
													{(
														(totalPaidAmount / totalCreditAmount) *
														100
													).toFixed(1)}
													%
												</p>
											</div>
										</div>
										<div className="flex-1">
											<p className="text-sm text-gray-600">
												Collection efficiency based on total credits issued
											</p>
											<div className="mt-2 space-y-1">
												<p className="text-sm">
													✅ Paid: ₱{totalPaidAmount.toFixed(2)}
												</p>
												<p className="text-sm">
													⏳ Pending: ₱{totalPendingAmount.toFixed(2)}
												</p>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Active Credits */}
							<div className="bg-white rounded-xl border border-gray-200 p-4">
								<h3 className="font-bold text-gray-800 mb-3">
									📋 Active Credits
								</h3>
								{creditLogs.filter((c) => c.status !== "paid").length === 0 ? (
									<p className="text-center text-gray-500 py-8">
										No active credits
									</p>
								) : (
									<div className="space-y-3">
										{creditLogs
											.filter((c) => c.status !== "paid")
											.slice(0, 10)
											.map((credit) => {
												const remaining =
													(credit.amount || 0) - (credit.paidAmount || 0);
												const isOverdue =
													credit.dueDate &&
													new Date(credit.dueDate) < new Date();

												return (
													<div
														key={credit.id}
														className={`border rounded-lg p-3 ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
														<div className="flex justify-between items-start mb-2">
															<div>
																<p className="font-semibold text-gray-800">
																	{credit.customerName}
																</p>
																<p className="text-xs text-gray-500">
																	Due:{" "}
																	{credit.dueDate
																		? new Date(
																				credit.dueDate,
																			).toLocaleDateString()
																		: "No due date"}
																</p>
															</div>
															<span
																className={`px-2 py-1 rounded-full text-xs font-semibold ${
																	credit.status === "partial"
																		? "bg-yellow-100 text-yellow-700"
																		: "bg-red-100 text-red-700"
																}`}>
																{credit.status === "partial"
																	? "Partial"
																	: "Unpaid"}
															</span>
														</div>
														<div className="grid grid-cols-3 gap-2 text-sm">
															<div>
																<p className="text-xs text-gray-500">Total</p>
																<p className="font-semibold">
																	₱{(credit.amount || 0).toFixed(2)}
																</p>
															</div>
															<div>
																<p className="text-xs text-gray-500">Paid</p>
																<p className="font-semibold text-green-600">
																	₱{(credit.paidAmount || 0).toFixed(2)}
																</p>
															</div>
															<div>
																<p className="text-xs text-gray-500">Balance</p>
																<p className="font-semibold text-red-600">
																	₱{remaining.toFixed(2)}
																</p>
															</div>
														</div>
													</div>
												);
											})}
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
					<p className="text-xs text-gray-500 text-center">
						📊 Report generated on {new Date().toLocaleString()} • Data reflects
						real-time inventory and sales
					</p>
				</div>
			</div>
		</div>
	);
}
