// src/ReportsPanel.jsx
import React, { useState, useEffect } from "react";
import { db } from "./db";
import toast from "react-hot-toast";

export default function ReportsPanel({ onClose }) {
	const [activeTab, setActiveTab] = useState("sales");
	const [showExportOptions, setShowExportOptions] = useState(false);
	const [dateRange, setDateRange] = useState("today");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [reorderThreshold, setReorderThreshold] = useState(7);
	const [loading, setLoading] = useState(true);

	// Data states
	const [salesData, setSalesData] = useState([]);
	const [inventoryData, setInventoryData] = useState([]);
	const [creditData, setCreditData] = useState([]);
	const [saleItemsData, setSaleItemsData] = useState([]);

	// Computed states
	const [totalSales, setTotalSales] = useState(0);
	const [totalTransactions, setTotalTransactions] = useState(0);
	const [averageTransaction, setAverageTransaction] = useState(0);
	const [dailySales, setDailySales] = useState({});
	const [topProducts, setTopProducts] = useState([]);
	const [filteredSales, setFilteredSales] = useState([]);
	const [lowStockItems, setLowStockItems] = useState([]);
	const [outOfStockItems, setOutOfStockItems] = useState([]);
	const [totalInventoryValue, setTotalInventoryValue] = useState(0);
	const [totalRetailValue, setTotalRetailValue] = useState(0);
	const [potentialProfit, setPotentialProfit] = useState(0);
	const [suggestedOrder, setSuggestedOrder] = useState([]);
	const [criticalItems, setCriticalItems] = useState(0);
	const [highPriorityItems, setHighPriorityItems] = useState(0);
	const [totalReorderCost, setTotalReorderCost] = useState(0);
	const [totalCreditAmount, setTotalCreditAmount] = useState(0);
	const [totalPaidAmount, setTotalPaidAmount] = useState(0);
	const [totalPendingAmount, setTotalPendingAmount] = useState(0);
	const [overdueCredits, setOverdueCredits] = useState(0);
	const [creditLogs, setCreditLogs] = useState([]);

	useEffect(() => {
		loadData();
		// Set default dates
		const today = new Date();
		setStartDate(today.toISOString().split("T")[0]);
		const weekAgo = new Date(today);
		weekAgo.setDate(today.getDate() - 7);
		setEndDate(today.toISOString().split("T")[0]);
	}, []);

	useEffect(() => {
		if (salesData.length > 0) {
			calculateSalesMetrics();
		}
	}, [salesData, dateRange, startDate, endDate]);

	useEffect(() => {
		if (inventoryData.length > 0) {
			calculateInventoryMetrics();
			calculateReorderReport();
		}
	}, [inventoryData, salesData, saleItemsData, reorderThreshold]);

	useEffect(() => {
		if (creditData.length > 0) {
			calculateCreditMetrics();
		}
	}, [creditData]);

	const loadData = async () => {
		try {
			setLoading(true);
			const [salesRes, inventoryRes, creditRes, saleItemsRes] = await Promise.all([
				db.from("sales").select("*").order("created_at", { ascending: false }),
				db.from("inventory").select("*"),
				db.from("credit_logs").select("*"),
				db.from("sale_items").select("*"),
			]);

			if (salesRes.error) throw salesRes.error;
			if (inventoryRes.error) throw inventoryRes.error;
			if (creditRes.error) throw creditRes.error;
			if (saleItemsRes.error) throw saleItemsRes.error;

			setSalesData(salesRes.data || []);
			setInventoryData(inventoryRes.data || []);
			setCreditData(creditRes.data || []);
			setSaleItemsData(saleItemsRes.data || []);
			setCreditLogs(creditRes.data || []);
		} catch (error) {
			console.error("Error loading data:", error);
			toast.error("Failed to load report data");
		} finally {
			setLoading(false);
		}
	};

	const calculateSalesMetrics = () => {
		let filtered = [...salesData];

		if (dateRange === "today") {
			const today = new Date().toISOString().split("T")[0];
			filtered = filtered.filter(
				(s) => s.created_at && s.created_at.split("T")[0] === today
			);
		} else if (dateRange === "week") {
			const weekAgo = new Date();
			weekAgo.setDate(weekAgo.getDate() - 7);
			filtered = filtered.filter(
				(s) => s.created_at && new Date(s.created_at) >= weekAgo
			);
		} else if (dateRange === "month") {
			const monthAgo = new Date();
			monthAgo.setMonth(monthAgo.getMonth() - 1);
			filtered = filtered.filter(
				(s) => s.created_at && new Date(s.created_at) >= monthAgo
			);
		} else if (dateRange === "custom" && startDate && endDate) {
			filtered = filtered.filter(
				(s) =>
					s.created_at &&
					s.created_at.split("T")[0] >= startDate &&
					s.created_at.split("T")[0] <= endDate
			);
		}

		setFilteredSales(filtered);

		// Calculate total sales
		const total = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
		setTotalSales(total);

		// Calculate transactions
		const count = filtered.length;
		setTotalTransactions(count);

		// Calculate average
		setAverageTransaction(count > 0 ? total / count : 0);

		// Calculate daily sales
		const daily = {};
		filtered.forEach((s) => {
			if (s.created_at) {
				const date = s.created_at.split("T")[0];
				if (!daily[date]) {
					daily[date] = { total: 0, count: 0 };
				}
				daily[date].total += s.total || 0;
				daily[date].count += 1;
			}
		});
		setDailySales(daily);

		// Calculate top products
		const productSales = {};
		saleItemsData.forEach((item) => {
			const sale = filtered.find((s) => s.id === item.sale_id);
			if (sale) {
				const product = inventoryData.find((p) => p.id === item.product_id);
				if (product) {
					if (!productSales[product.id]) {
						productSales[product.id] = {
							name: product.name,
							quantity: 0,
							revenue: 0,
						};
					}
					productSales[product.id].quantity += item.quantity || 0;
					productSales[product.id].revenue += item.subtotal || 0;
				}
			}
		});
		const sorted = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
		setTopProducts(sorted.slice(0, 10));
	};

	const calculateInventoryMetrics = () => {
		// Low stock items (<5)
		const low = inventoryData.filter((item) => item.stock > 0 && item.stock < 5);
		setLowStockItems(low);

		// Out of stock items
		const out = inventoryData.filter((item) => item.stock === 0);
		setOutOfStockItems(out);

		// Total inventory value (cost)
		const totalCost = inventoryData.reduce(
			(sum, item) => sum + (item.cost_price || 0) * (item.stock || 0),
			0
		);
		setTotalInventoryValue(totalCost);

		// Total retail value
		const totalRetail = inventoryData.reduce(
			(sum, item) => sum + (item.selling_price || 0) * (item.stock || 0),
			0
		);
		setTotalRetailValue(totalRetail);

		// Potential profit
		setPotentialProfit(totalRetail - totalCost);
	};

	const calculateReorderReport = () => {
		const suggestions = [];
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		inventoryData.forEach((product) => {
			// Calculate daily sales average for this product
			const productSales = saleItemsData.filter(
				(item) =>
					item.product_id === product.id &&
					salesData.some(
						(s) =>
							s.id === item.sale_id &&
							s.created_at &&
							new Date(s.created_at) >= thirtyDaysAgo
					)
			);

			const totalQuantity = productSales.reduce((sum, item) => sum + (item.quantity || 0), 0);
			const avgDailySales = totalQuantity / 30; // Average over 30 days

			if (avgDailySales > 0 && product.stock > 0) {
				const daysOfStock = product.stock / avgDailySales;
				const suggestedQuantity = Math.ceil(avgDailySales * reorderThreshold) - product.stock;

				if (suggestedQuantity > 0) {
					let priority = "low";
					let urgencyMessage = "Stock level is adequate";

					if (daysOfStock <= 2) {
						priority = "critical";
						urgencyMessage = "🚨 Critical! Will run out in 1-2 days";
					} else if (daysOfStock <= 5) {
						priority = "high";
						urgencyMessage = "⚠️ High priority! Low stock, reorder soon";
					} else if (daysOfStock <= 10) {
						priority = "medium";
						urgencyMessage = "📋 Medium priority - reorder within the week";
					} else {
						urgencyMessage = "✅ Stock is sufficient for now";
					}

					suggestions.push({
						...product,
						avgDailySales: avgDailySales.toFixed(1),
						daysOfStock: Math.round(daysOfStock),
						suggestedQuantity: Math.max(suggestedQuantity, 10),
						estimatedCost: (product.cost_price || 0) * Math.max(suggestedQuantity, 10),
						priority,
						urgencyMessage,
						currentStock: product.stock,
					});
				}
			} else if (product.stock === 0 && avgDailySales > 0) {
				// Out of stock but has sales history
				const suggestedQuantity = Math.ceil(avgDailySales * reorderThreshold);
				suggestions.push({
					...product,
					avgDailySales: avgDailySales.toFixed(1),
					daysOfStock: 0,
					suggestedQuantity: Math.max(suggestedQuantity, 10),
					estimatedCost: (product.cost_price || 0) * Math.max(suggestedQuantity, 10),
					priority: "critical",
					urgencyMessage: "🚨 Out of stock! Immediate reorder needed",
					currentStock: 0,
				});
			}
		});

		// Sort by priority
		const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

		setSuggestedOrder(suggestions);
		setCriticalItems(suggestions.filter((i) => i.priority === "critical").length);
		setHighPriorityItems(suggestions.filter((i) => i.priority === "high").length);
		setTotalReorderCost(suggestions.reduce((sum, i) => sum + i.estimatedCost, 0));
	};

	const calculateCreditMetrics = () => {
		const total = creditData.reduce((sum, c) => sum + (c.amount || 0), 0);
		const paid = creditData.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
		const pending = total - paid;

		const overdue = creditData.filter(
			(c) =>
				c.dueDate &&
				new Date(c.dueDate) < new Date() &&
				(c.status === "unpaid" || c.status === "partial")
		).length;

		setTotalCreditAmount(total);
		setTotalPaidAmount(paid);
		setTotalPendingAmount(pending);
		setOverdueCredits(overdue);
	};

	const exportToCSV = (reportType) => {
		try {
			let headers = [];
			let rows = [];

			if (reportType === "sales") {
				headers = ["Date", "Sale ID", "Total", "Cash Received", "Change Due"];
				rows = filteredSales.map((s) => [
					new Date(s.created_at).toLocaleString(),
					s.id,
					(s.total || 0).toFixed(2),
					(s.cash_received || 0).toFixed(2),
					(s.change_due || 0).toFixed(2),
				]);
			} else if (reportType === "inventory") {
				headers = ["Product", "Barcode", "Cost Price", "Selling Price", "Stock", "Total Value"];
				rows = inventoryData.map((i) => [
					i.name,
					i.barcode || "N/A",
					(i.cost_price || 0).toFixed(2),
					(i.selling_price || 0).toFixed(2),
					i.stock || 0,
					((i.cost_price || 0) * (i.stock || 0)).toFixed(2),
				]);
			} else if (reportType === "reorder") {
				headers = [
					"Product",
					"Current Stock",
					"Daily Avg",
					"Days Left",
					"Suggested Order",
					"Est. Cost",
					"Priority",
				];
				rows = suggestedOrder.map((i) => [
					i.name,
					i.currentStock,
					i.avgDailySales,
					i.daysOfStock,
					i.suggestedQuantity,
					i.estimatedCost.toFixed(2),
					i.priority.toUpperCase(),
				]);
			}

			let csv = headers.join(",") + "\n";
			rows.forEach((row) => {
				csv += row.join(",") + "\n";
			});

			const blob = new Blob([csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${reportType}_report_${new Date().toISOString().split("T")[0]}.csv`;
			a.click();
			URL.revokeObjectURL(url);

			toast.success(`${reportType} report exported successfully!`, {
				duration: 3000,
				position: "top-right",
			});
		} catch (error) {
			console.error("Export error:", error);
			toast.error("Failed to export report", {
				duration: 3000,
				position: "top-right",
			});
		}
	};

	const printReport = () => {
		window.print();
	};

	if (loading) {
		return (
			<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
				<div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
					<div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
					<p className="text-gray-600">Loading reports...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
			<div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
				{/* Header */}
				<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
						<div>
							<h2 className="text-white font-bold text-lg sm:text-xl flex items-center gap-2">
								<span className="text-xl sm:text-2xl">📊</span>
								<span>Reports & Analytics</span>
							</h2>
							<p className="text-white/80 text-xs sm:text-sm mt-0.5">
								Monitor sales, inventory, and credit performance
							</p>
						</div>
						<div className="flex gap-2 w-full sm:w-auto relative">
							<button
								onClick={() => setShowExportOptions(!showExportOptions)}
								className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white/20 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-white/30 transition">
								📥 Export
							</button>
							<button
								onClick={printReport}
								className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white/20 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-white/30 transition">
								🖨️ Print
							</button>
							<button
								onClick={onClose}
								className="px-3 py-2 text-white/80 hover:text-white text-xl sm:text-2xl leading-none transition-colors">
								✕
							</button>

							{/* Export Options Dropdown */}
							{showExportOptions && (
								<div className="absolute right-0 top-12 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 min-w-[160px] sm:min-w-[180px]">
									<button
										onClick={() => {
											exportToCSV("sales");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-xs sm:text-sm">
										📊 Sales Report
									</button>
									<button
										onClick={() => {
											exportToCSV("inventory");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 text-xs sm:text-sm border-t border-gray-100">
										📦 Inventory Report
									</button>
									<button
										onClick={() => {
											exportToCSV("reorder");
											setShowExportOptions(false);
										}}
										className="block w-full text-left px-4 py-2.5 hover:bg-gray-50 rounded-b-xl text-xs sm:text-sm border-t border-gray-100">
										📋 Reorder Report
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Tabs - Mobile Friendly */}
				<div className="border-b border-gray-200 px-2 sm:px-6 overflow-x-auto flex-shrink-0">
					<div className="flex gap-0.5 sm:gap-1 min-w-max">
						<button
							onClick={() => setActiveTab("sales")}
							className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition whitespace-nowrap relative ${
								activeTab === "sales"
									? "text-blue-600"
									: "text-gray-500 hover:text-gray-700"
							}`}>
							<span className="flex items-center gap-1 sm:gap-2">
								<span className="text-sm sm:text-lg">💰</span>
								<span className="hidden xs:inline">Sales Report</span>
								<span className="xs:hidden">Sales</span>
							</span>
							{activeTab === "sales" && (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
							)}
						</button>

						<button
							onClick={() => setActiveTab("reorder")}
							className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition whitespace-nowrap relative ${
								activeTab === "reorder"
									? "text-blue-600"
									: "text-gray-500 hover:text-gray-700"
							}`}>
							<span className="flex items-center gap-1 sm:gap-2">
								<span className="text-sm sm:text-lg">📋</span>
								<span className="hidden xs:inline">Reorder Report</span>
								<span className="xs:hidden">Reorder</span>
							</span>
							{activeTab === "reorder" && (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
							)}
						</button>

						<button
							onClick={() => setActiveTab("inventory")}
							className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition whitespace-nowrap relative ${
								activeTab === "inventory"
									? "text-blue-600"
									: "text-gray-500 hover:text-gray-700"
							}`}>
							<span className="flex items-center gap-1 sm:gap-2">
								<span className="text-sm sm:text-lg">📦</span>
								<span className="hidden xs:inline">Inventory Report</span>
								<span className="xs:hidden">Inventory</span>
							</span>
							{activeTab === "inventory" && (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
							)}
						</button>

						<button
							onClick={() => setActiveTab("credits")}
							className={`px-2.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-semibold transition whitespace-nowrap relative ${
								activeTab === "credits"
									? "text-blue-600"
									: "text-gray-500 hover:text-gray-700"
							}`}>
							<span className="flex items-center gap-1 sm:gap-2">
								<span className="text-sm sm:text-lg">📝</span>
								<span className="hidden xs:inline">Credit Report</span>
								<span className="xs:hidden">Credits</span>
							</span>
							{activeTab === "credits" && (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></span>
							)}
						</button>
					</div>
				</div>

				{/* Content - Mobile Friendly */}
				<div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
					{/* REORDER REPORT */}
					{activeTab === "reorder" && (
						<div className="space-y-4 sm:space-y-6">
							{/* Settings */}
							<div className="bg-gray-50 rounded-xl p-3 sm:p-4">
								<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
									<div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
										<span className="font-semibold text-gray-700 text-sm sm:text-base">
											Reorder Alert:
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
												className="w-32 sm:w-48"
											/>
											<span className="font-bold text-blue-600 min-w-[50px] sm:min-w-[60px] text-sm sm:text-base">
												{reorderThreshold} days
											</span>
										</div>
									</div>
									<div className="text-xs sm:text-sm text-gray-500">
										💡 Items with &lt; {reorderThreshold} days stock
									</div>
								</div>
							</div>

							{/* Summary Cards - Mobile Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
								<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-red-100 text-[10px] sm:text-sm">Critical</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{criticalItems}</p>
									<p className="text-[8px] sm:text-xs text-red-100 mt-0.5">1-2 days left</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-orange-100 text-[10px] sm:text-sm">High Priority</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{highPriorityItems}</p>
									<p className="text-[8px] sm:text-xs text-orange-100 mt-0.5">Reorder soon</p>
								</div>
								<div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-yellow-100 text-[10px] sm:text-sm">To Reorder</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{suggestedOrder.length}</p>
									<p className="text-[8px] sm:text-xs text-yellow-100 mt-0.5">Need restock</p>
								</div>
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-blue-100 text-[10px] sm:text-sm">Est. Cost</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">₱{totalReorderCost.toFixed(2)}</p>
									<p className="text-[8px] sm:text-xs text-blue-100 mt-0.5">Suggested order</p>
								</div>
							</div>

							{/* Reorder List */}
							<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
								<h3 className="font-bold text-gray-800 mb-3 text-sm sm:text-base flex items-center gap-2">
									📋 Suggested Reorder List
									<span className="text-[10px] sm:text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
										30-day trend
									</span>
								</h3>

								{suggestedOrder.length === 0 ? (
									<div className="text-center py-8 sm:py-12">
										<div className="text-3xl sm:text-5xl mb-3">✅</div>
										<p className="text-gray-500 font-medium text-sm sm:text-base">
											No items need reordering
										</p>
										<p className="text-[10px] sm:text-xs text-gray-400 mt-1">
											All products have sufficient stock
										</p>
									</div>
								) : (
									<div className="space-y-3 sm:space-y-4">
										{suggestedOrder.slice(0, 10).map((item) => (
											<div
												key={item.id}
												className={`border-2 rounded-xl p-3 sm:p-4 transition-all ${
													item.priority === "critical"
														? "border-red-300 bg-red-50"
														: item.priority === "high"
															? "border-orange-300 bg-orange-50"
															: item.priority === "medium"
																? "border-yellow-300 bg-yellow-50"
																: "border-gray-200 bg-white"
												}`}>
												<div className="flex flex-col sm:flex-row justify-between items-start mb-2 sm:mb-3 gap-2">
													<div className="flex-1 w-full">
														<div className="flex items-center gap-2 flex-wrap">
															<h4 className="font-bold text-gray-800 text-sm sm:text-lg">
																{item.name}
															</h4>
															<span
																className={`px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-semibold ${
																	item.priority === "critical"
																		? "bg-red-200 text-red-800"
																		: item.priority === "high"
																			? "bg-orange-200 text-orange-800"
																			: item.priority === "medium"
																				? "bg-yellow-200 text-yellow-800"
																				: "bg-gray-200 text-gray-700"
																}`}>
																{item.priority.toUpperCase()}
															</span>
														</div>
														<p className="text-xs sm:text-sm text-red-600 font-medium mt-1">
															{item.urgencyMessage}
														</p>
													</div>
													<div className="text-right w-full sm:w-auto">
														<p className="text-[10px] sm:text-xs text-gray-500">Est. Cost</p>
														<p className="text-lg sm:text-xl font-bold text-blue-600">
															₱{item.estimatedCost.toFixed(2)}
														</p>
													</div>
												</div>

												{/* Mobile-friendly grid */}
												<div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 text-xs sm:text-sm mt-3">
													<div>
														<p className="text-[8px] sm:text-xs text-gray-500">Stock</p>
														<p className={`font-bold text-base sm:text-lg ${item.currentStock === 0 ? "text-red-600" : "text-gray-800"}`}>
															{item.currentStock}
														</p>
													</div>
													<div>
														<p className="text-[8px] sm:text-xs text-gray-500">Daily Avg</p>
														<p className="font-semibold text-gray-800 text-sm sm:text-base">
															{item.avgDailySales}
														</p>
													</div>
													<div>
														<p className="text-[8px] sm:text-xs text-gray-500">Days Left</p>
														<p className={`font-bold text-sm sm:text-base ${
															item.daysOfStock <= 2
																? "text-red-600"
																: item.daysOfStock <= 5
																	? "text-orange-600"
																	: "text-yellow-600"
														}`}>
															{item.daysOfStock}
														</p>
													</div>
													<div className="hidden sm:block">
														<p className="text-xs text-gray-500">Suggested</p>
														<p className="font-bold text-green-600">
															{item.suggestedQuantity}
														</p>
													</div>
													<div className="hidden sm:block">
														<p className="text-xs text-gray-500">Cost/Unit</p>
														<p className="text-gray-700">
															₱{(item.cost_price || 0).toFixed(2)}
														</p>
													</div>
												</div>

												{/* Progress bar for stock level */}
												<div className="mt-2 sm:mt-3">
													<div className="flex justify-between text-[8px] sm:text-xs mb-1">
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
													<div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
														<div
															className={`rounded-full h-1.5 sm:h-2 transition-all ${
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
										{suggestedOrder.length > 10 && (
											<p className="text-center text-gray-500 text-xs sm:text-sm">
												+ {suggestedOrder.length - 10} more items
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					)}

					{/* SALES REPORT */}
					{activeTab === "sales" && (
						<div className="space-y-4 sm:space-y-6">
							{/* Date Filter */}
							<div className="bg-gray-50 rounded-xl p-3 sm:p-4">
								<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
									<span className="font-semibold text-gray-700 text-sm sm:text-base">
										Date Range:
									</span>
									<div className="flex gap-1 sm:gap-2 flex-wrap">
										{["today", "week", "month", "custom"].map((range) => (
											<button
												key={range}
												onClick={() => setDateRange(range)}
												className={`px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-sm capitalize transition ${
													dateRange === range
														? "bg-blue-600 text-white"
														: "bg-white text-gray-600 hover:bg-gray-100"
												}`}>
												{range === "today"
													? "Today"
													: range === "week"
														? "Week"
														: range === "month"
															? "Month"
															: "Custom"}
											</button>
										))}
									</div>
									{dateRange === "custom" && (
										<div className="flex gap-2 items-center flex-wrap">
											<input
												type="date"
												value={startDate}
												onChange={(e) => setStartDate(e.target.value)}
												className="px-2 sm:px-3 py-1 border rounded-lg text-xs sm:text-sm w-28 sm:w-auto"
											/>
											<span className="text-xs sm:text-sm">to</span>
											<input
												type="date"
												value={endDate}
												onChange={(e) => setEndDate(e.target.value)}
												className="px-2 sm:px-3 py-1 border rounded-lg text-xs sm:text-sm w-28 sm:w-auto"
											/>
										</div>
									)}
								</div>
							</div>

							{/* Key Metrics - Mobile Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-green-100 text-[10px] sm:text-sm">Total Sales</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalSales.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-blue-100 text-[10px] sm:text-sm">Transactions</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{totalTransactions}</p>
								</div>
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-purple-100 text-[10px] sm:text-sm">Avg. Transaction</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{averageTransaction.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-orange-100 text-[10px] sm:text-sm">Daily Avg</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱
										{(
											totalSales / Math.max(Object.keys(dailySales).length, 1)
										).toFixed(2)}
									</p>
								</div>
							</div>

							{/* Daily Sales Trend */}
							{Object.keys(dailySales).length > 0 && (
								<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
									<h3 className="font-bold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">
										📈 Daily Sales Trend
									</h3>
									<div className="space-y-2">
										{Object.entries(dailySales)
											.slice(-7)
											.reverse()
											.map(([date, data]) => (
												<div key={date}>
													<div className="flex justify-between text-[10px] sm:text-sm mb-1">
														<span className="text-gray-600">
															{new Date(date).toLocaleDateString()}
														</span>
														<span className="font-semibold text-xs sm:text-sm">
															₱{data.total.toFixed(2)}
														</span>
													</div>
													<div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
														<div
															className="bg-green-500 rounded-full h-1.5 sm:h-2 transition-all"
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
							<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
								<h3 className="font-bold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">
									🏆 Top Selling Products
								</h3>
								{topProducts.length === 0 ? (
									<p className="text-center text-gray-500 py-6 sm:py-8 text-xs sm:text-sm">
										No sales data available
									</p>
								) : (
									<div className="space-y-2 sm:space-y-3">
										{topProducts.slice(0, 5).map((product, idx) => (
											<div
												key={idx}
												className="flex justify-between items-center">
												<div className="flex items-center gap-2 sm:gap-3 min-w-0">
													<span className="text-lg sm:text-2xl flex-shrink-0">
														{idx === 0
															? "🥇"
															: idx === 1
																? "🥈"
																: idx === 2
																	? "🥉"
																	: "📦"}
													</span>
													<div className="min-w-0">
														<p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">
															{product.name}
														</p>
														<p className="text-[8px] sm:text-xs text-gray-500">
															{product.quantity} units sold
														</p>
													</div>
												</div>
												<p className="font-bold text-green-600 text-xs sm:text-sm flex-shrink-0">
													₱{(product.revenue || 0).toFixed(2)}
												</p>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					)}

					{/* INVENTORY REPORT */}
					{activeTab === "inventory" && (
						<div className="space-y-4 sm:space-y-6">
							{/* Key Metrics */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
								<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-blue-100 text-[10px] sm:text-sm">Total Products</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{inventoryData.length}</p>
								</div>
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-green-100 text-[10px] sm:text-sm">Inventory Value</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalInventoryValue.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-purple-100 text-[10px] sm:text-sm">Retail Value</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalRetailValue.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-orange-100 text-[10px] sm:text-sm">Potential Profit</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{potentialProfit.toFixed(2)}
									</p>
								</div>
							</div>

							{/* Stock Alerts */}
							{(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
								<div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-3 sm:p-4">
									<h3 className="font-bold text-yellow-800 mb-1 sm:mb-2 text-sm sm:text-base">
										⚠️ Stock Alerts
									</h3>
									{lowStockItems.length > 0 && (
										<p className="text-xs sm:text-sm text-yellow-700">
											• {lowStockItems.length} product(s) running low (&lt;5 units)
										</p>
									)}
									{outOfStockItems.length > 0 && (
										<p className="text-xs sm:text-sm text-red-700">
											• {outOfStockItems.length} product(s) out of stock
										</p>
									)}
								</div>
							)}

							{/* Stock Distribution */}
							<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
								<h3 className="font-bold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">
									📊 Stock Distribution
								</h3>
								<div className="space-y-2">
									<div>
										<div className="flex justify-between text-[10px] sm:text-sm mb-1">
											<span>In Stock (&gt;5)</span>
											<span>
												{inventoryData.filter((i) => i.stock > 5).length} products
											</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
											<div
												className="bg-green-500 rounded-full h-1.5 sm:h-2"
												style={{
													width: `${(inventoryData.filter((i) => i.stock > 5).length / inventoryData.length) * 100}%`,
												}}
											/>
										</div>
									</div>
									<div>
										<div className="flex justify-between text-[10px] sm:text-sm mb-1">
											<span>Low Stock (1-5)</span>
											<span>{lowStockItems.length} products</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
											<div
												className="bg-yellow-500 rounded-full h-1.5 sm:h-2"
												style={{
													width: `${(lowStockItems.length / inventoryData.length) * 100}%`,
												}}
											/>
										</div>
									</div>
									<div>
										<div className="flex justify-between text-[10px] sm:text-sm mb-1">
											<span>Out of Stock</span>
											<span>{outOfStockItems.length} products</span>
										</div>
										<div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
											<div
												className="bg-red-500 rounded-full h-1.5 sm:h-2"
												style={{
													width: `${(outOfStockItems.length / inventoryData.length) * 100}%`,
												}}
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* CREDIT REPORT */}
					{activeTab === "credits" && (
						<div className="space-y-4 sm:space-y-6">
							{/* Key Metrics */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
								<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-purple-100 text-[10px] sm:text-sm">Total Credits</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalCreditAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-green-100 text-[10px] sm:text-sm">Total Paid</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalPaidAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-red-100 text-[10px] sm:text-sm">Pending Balance</p>
									<p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">
										₱{totalPendingAmount.toFixed(2)}
									</p>
								</div>
								<div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
									<p className="text-orange-100 text-[10px] sm:text-sm">Overdue</p>
									<p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{overdueCredits}</p>
								</div>
							</div>

							{/* Collection Rate */}
							{totalCreditAmount > 0 && (
								<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
									<h3 className="font-bold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">
										📊 Collection Rate
									</h3>
									<div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
										<div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
											<svg className="w-24 h-24 sm:w-32 sm:h-32 transform -rotate-90">
												<circle
													cx="48"
													cy="48"
													r="40"
													stroke="#e5e7eb"
													strokeWidth="10"
													fill="none"
												/>
												<circle
													cx="48"
													cy="48"
													r="40"
													stroke="#10b981"
													strokeWidth="10"
													fill="none"
													strokeDasharray={`${(totalPaidAmount / totalCreditAmount) * 251} 251`}
													strokeLinecap="round"
												/>
											</svg>
											<div className="absolute inset-0 flex items-center justify-center">
												<p className="text-xl sm:text-2xl font-bold text-green-600">
													{(
														(totalPaidAmount / totalCreditAmount) *
														100
													).toFixed(1)}
													%
												</p>
											</div>
										</div>
										<div className="flex-1 text-center sm:text-left">
											<p className="text-xs sm:text-sm text-gray-600">
												Collection efficiency based on total credits issued
											</p>
											<div className="mt-2 space-y-1">
												<p className="text-xs sm:text-sm">
													✅ Paid: ₱{totalPaidAmount.toFixed(2)}
												</p>
												<p className="text-xs sm:text-sm">
													⏳ Pending: ₱{totalPendingAmount.toFixed(2)}
												</p>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Active Credits */}
							<div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
								<h3 className="font-bold text-gray-800 mb-2 sm:mb-3 text-sm sm:text-base">
									📋 Active Credits
								</h3>
								{creditLogs.filter((c) => c.status !== "paid").length === 0 ? (
									<p className="text-center text-gray-500 py-6 sm:py-8 text-xs sm:text-sm">
										No active credits
									</p>
								) : (
									<div className="space-y-2 sm:space-y-3">
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
														<div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-1">
															<div>
																<p className="font-semibold text-gray-800 text-sm sm:text-base">
																	{credit.customerName}
																</p>
																<p className="text-[8px] sm:text-xs text-gray-500">
																	Due:{" "}
																	{credit.dueDate
																		? new Date(
																				credit.dueDate,
																			).toLocaleDateString()
																		: "No due date"}
																</p>
															</div>
															<span
																className={`px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-semibold ${
																	credit.status === "partial"
																		? "bg-yellow-100 text-yellow-700"
																		: "bg-red-100 text-red-700"
																}`}>
																{credit.status === "partial"
																	? "Partial"
																	: "Unpaid"}
															</span>
														</div>
														<div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
															<div>
																<p className="text-[8px] sm:text-xs text-gray-500">Total</p>
																<p className="font-semibold text-sm sm:text-base">
																	₱{(credit.amount || 0).toFixed(2)}
																</p>
															</div>
															<div>
																<p className="text-[8px] sm:text-xs text-gray-500">Paid</p>
																<p className="font-semibold text-green-600 text-sm sm:text-base">
																	₱{(credit.paidAmount || 0).toFixed(2)}
																</p>
															</div>
															<div>
																<p className="text-[8px] sm:text-xs text-gray-500">Balance</p>
																<p className="font-semibold text-red-600 text-sm sm:text-base">
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
				<div className="bg-gray-50 px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-200 flex-shrink-0">
					<p className="text-[8px] sm:text-xs text-gray-500 text-center">
						📊 Report generated on {new Date().toLocaleString()} • Data reflects real-time inventory and sales
					</p>
				</div>
			</div>
		</div>
	);
}