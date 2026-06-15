// src/CreditPanel.jsx
import React, { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Swal from "sweetalert2";
import toast, { Toaster } from "react-hot-toast";
import { db } from "./db";

export default function CreditPanel({ onClose }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showCreditList, setShowCreditList] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch inventory from database
  const inventory = useLiveQuery(() => db.inventory.toArray(), []) || [];

  // Fetch all credit records
  const creditLogs =
    useLiveQuery(() => db.from('credit_log').orderBy("id").reverse().toArray(), []) ||
    [];

  // Search products as user types
  useEffect(() => {
    const searchProducts = () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        setShowSuggestions(false);
        return;
      }

      const searchTermLower = searchTerm.toLowerCase().trim();
      const results = inventory
        .filter(
          (product) =>
            product.name.toLowerCase().includes(searchTermLower) ||
            (product.barcode &&
              product.barcode.toLowerCase().includes(searchTermLower))
        )
        .slice(0, 10); // Show top 10 results

      setSearchResults(results);
      setShowSuggestions(results.length > 0);
      setSelectedSuggestionIndex(-1);
    };

    // Debounce search to avoid excessive filtering
    const debounceTimer = setTimeout(searchProducts, 200);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, inventory]);

  const handleKeyDown = (e) => {
    if (!showSuggestions || searchResults.length === 0) {
      // If no suggestions, still allow enter to search
      if (e.key === "Enter" && searchTerm.trim()) {
        e.preventDefault();
        handleSearchSubmit();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
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
          searchResults[selectedSuggestionIndex]
        ) {
          addToCart(searchResults[selectedSuggestionIndex]);
          setSearchTerm("");
          setShowSuggestions(false);
          setSearchResults([]);
        } else if (searchTerm.trim()) {
          handleSearchSubmit();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  const handleSearchSubmit = () => {
    if (searchTerm.trim().length < 2) return;

    // Search for exact match first
    const exactMatch = inventory.find(
      (product) =>
        product.name.toLowerCase() === searchTerm.toLowerCase() ||
        (product.barcode &&
          product.barcode.toLowerCase() === searchTerm.toLowerCase())
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchTerm("");
      setShowSuggestions(false);
      setSearchResults([]);
    } else if (searchResults.length > 0) {
      // If no exact match but there are results, add the first one
      addToCart(searchResults[0]);
      setSearchTerm("");
      setShowSuggestions(false);
      setSearchResults([]);
    } else {
      toast.error(`Product "${searchTerm}" not found in inventory.`);
    }
  };

  const addToCart = (product) => {
    if (!product || product.stock === undefined) {
      console.error("Invalid product:", product);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.id === product.id
      );
      if (existingIndex > -1) {
        const updatedCart = [...prevCart];
        if (updatedCart[existingIndex].quantity >= product.stock) {
          toast.error(`Only ${product.stock} pcs available.`);
          return prevCart;
        }
        updatedCart[existingIndex].quantity += 1;
        return updatedCart;
      } else {
        if (product.stock <= 0) {
          toast.error(`"${product.name}" is out of stock!`);
          return prevCart;
        }
        return [
          ...prevCart,
          {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            sellingPrice: product.sellingPrice,
            stock: product.stock,
            quantity: 1,
          },
        ];
      }
    });
  };

  const updateQuantity = (id, newQty, totalStock) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    if (newQty > totalStock) {
      toast.error(`Only ${totalStock} items available in stock.`);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: newQty } : item
      )
    );
  };

  const handleManualQuantityChange = (id, value, totalStock) => {
    let newQty = parseInt(value);
    if (isNaN(newQty)) newQty = 1;
    if (newQty < 1) newQty = 1;
    if (newQty > totalStock) {
      toast.error(`Only ${totalStock} items available in stock.`);
      newQty = totalStock;
    }
    updateQuantity(id, newQty, totalStock);
  };

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );

  const handleSaveCredit = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter customer name.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Please add items to credit.");
      return;
    }

    // Add confirmation dialog
    const result = await Swal.fire({
      title: "Save Credit Record?",
      html: `
      <div class="text-left">
        <p><strong>Customer:</strong> ${customerName.trim()}</p>
        <p><strong>Total Amount:</strong> ₱${totalAmount.toFixed(2)}</p>
        <p><strong>Items:</strong> ${cart.length} product(s)</p>
        <p><strong>Total Quantity:</strong> ${cart.reduce((sum, item) => sum + item.quantity, 0)} pcs</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>` : ""}
      </div>
    `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#8b5cf6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, save credit",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      await db.transaction("rw", [db.inventory, db.from('credit_log')], async () => {
        // Create credit record
        const creditId = await db.from('credit_log').add({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          amount: totalAmount,
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.sellingPrice,
            subtotal: item.sellingPrice * item.quantity,
          })),
          dueDate: dueDate || null,
          notes: notes || null,
          status: "unpaid",
          paidAmount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Deduct from inventory
        for (const item of cart) {
          const dbItem = await db.inventory.get(item.id);
          await db.inventory.update(item.id, {
            stock: Math.max(0, (dbItem?.stock || 0) - item.quantity),
          });
        }
      });

      toast.success("Credit record saved successfully!", {
        duration: 2000,
        position: "top-right",
      });

      Swal.fire({
        title: "✅ Credit Record Saved!",
        html: `
        <div class="text-left">
          <p><strong>Customer:</strong> ${customerName.trim()}</p>
          <p><strong>Total Amount:</strong> ₱${totalAmount.toFixed(2)}</p>
          <p><strong>Items:</strong> ${cart.length} product(s)</p>
        </div>
      `,
        icon: "success",
        confirmButtonColor: "#8b5cf6",
        confirmButtonText: "Done",
        timer: 3000,
        timerProgressBar: true,
      });

      resetForm();
    } catch (error) {
      console.error("Failed to save credit:", error);
      Swal.fire({
        title: "Error!",
        text: "Failed to save credit record.",
        icon: "error",
        confirmButtonColor: "#ef4444",
        confirmButtonText: "OK",
      });
    }
  };

  const handleCancelCredit = async (credit) => {
    const result = await Swal.fire({
        title: 'Cancel Credit Record?',
        html: `
        <div class="text-left">
            <p><strong>Customer:</strong> ${credit.customerName}</p>
            <p><strong>Total Amount:</strong> ₱${credit.amount.toFixed(2)}</p>
            <p><strong>Remaining Balance:</strong> ₱${(credit.amount - (credit.paidAmount || 0)).toFixed(2)}</p>
            <p><strong>Status:</strong> ${credit.status === 'paid' ? 'Paid' : credit.status === 'partial' ? 'Partial Payment' : 'Unpaid'}</p>
            ${credit.paidAmount > 0 ? `<p class="text-red-600 mt-2"><strong>⚠️ Note:</strong> This credit has ₱${credit.paidAmount.toFixed(2)} in payments. These will NOT be refunded automatically.</p>` : ''}
        </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, cancel credit',
        cancelButtonText: 'No, keep it',
        html: `
        <div class="text-left">
            <p><strong>Customer:</strong> ${credit.customerName}</p>
            <p><strong>Total Amount:</strong> ₱${credit.amount.toFixed(2)}</p>
            <p><strong>Paid Amount:</strong> ₱${(credit.paidAmount || 0).toFixed(2)}</p>
            <p><strong>Remaining Balance:</strong> ₱${(credit.amount - (credit.paidAmount || 0)).toFixed(2)}</p>
            <p><strong>Status:</strong> ${credit.status === 'paid' ? 'Paid' : credit.status === 'partial' ? 'Partial Payment' : 'Unpaid'}</p>
            ${credit.paidAmount > 0 ? `<p class="text-red-600 mt-3"><strong>⚠️ Important:</strong> This credit has ₱${credit.paidAmount.toFixed(2)} in payments. Cancelling will remove the record but payments received are NOT automatically refunded. Please handle refunds manually.</p>` : '<p class="text-yellow-600 mt-3">⚠️ Cancelling will restore all items back to inventory.</p>'}
        </div>
        `,
    });

    if (result.isConfirmed) {
        try {
        // Restore items back to inventory
        if (credit.items && credit.items.length > 0) {
            for (const item of credit.items) {
            const dbItem = await db.inventory.get(item.id);
            if (dbItem) {
                await db.inventory.update(item.id, { 
                stock: (dbItem.stock || 0) + item.quantity 
                });
            }
            }
        }

        // Delete the credit record
        await db.from('credit_log').delete(credit.id);
        
        toast.success(`Credit record for "${credit.customerName}" has been cancelled and items restored to inventory.`, {
            duration: 4000,
            position: 'top-right',
        });
        
        // Refresh the credit list (component will re-render automatically)
        } catch (error) {
        console.error("Failed to cancel credit:", error);
        Swal.fire({
            title: 'Error!',
            text: 'Failed to cancel credit record. Please try again.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'OK',
        });
        }
    }
 };

  const handleClearCart = async () => {
    const result = await Swal.fire({
      title: "Clear Cart?",
      text: "Are you sure you want to remove all items from this credit transaction?",
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

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDueDate("");
    setNotes("");
    setCart([]);
    setSearchTerm("");
    setSearchResults([]);
    setShowSuggestions(false);
  };

  const handleAddPayment = async (credit, paymentAmt) => {
    const newPaidAmount = (credit.paidAmount || 0) + Number(paymentAmt);
    const newStatus = newPaidAmount >= credit.amount ? "paid" : "partial";

    try {
      await db.from('credit_log').update(credit.id, {
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === "paid" && { paidAt: new Date().toISOString() }),
      });

      toast.success(`Payment of ₱${Number(paymentAmt).toFixed(2)} recorded!`, {
        duration: 3000,
        position: "top-right",
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setSelectedCredit(null);
    } catch (error) {
      console.error("Failed to add payment:", error);
      Swal.fire({
        title: "Error!",
        text: "Failed to record payment.",
        icon: "error",
        confirmButtonColor: "#ef4444",
        confirmButtonText: "OK",
      });
    }
  };

  const getRemainingBalance = (credit) => {
    return credit.amount - (credit.paidAmount || 0);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "paid":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
            ✅ Paid
          </span>
        );
      case "partial":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
            ⚠️ Partial
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
            ❌ Unpaid
          </span>
        );
    }
  };

  // Filter credits
  const filteredCredits = creditLogs.filter((credit) => {
    const matchesStatus =
      filterStatus === "all" || credit.status === filterStatus;
    return matchesStatus;
  });

  const totalCredits = creditLogs.reduce(
    (sum, credit) => sum + credit.amount,
    0
  );
  const totalPaid = creditLogs.reduce(
    (sum, credit) => sum + (credit.paidAmount || 0),
    0
  );
  const totalPending = totalCredits - totalPaid;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Add Toast Container here */}
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-white font-bold text-xl flex items-center gap-2">
                📝 Credit Management (Utang/Lista)
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Record credit purchases and track payments
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCreditList(!showCreditList);

                  resetForm();
                }}
                className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition"
              >
                {showCreditList ? "➕ New Credit" : "📋 View Credits"}
              </button>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {!showCreditList ? (
          /* New Credit Form - Like Regular POS */
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
              {/* Left Column - Customer Info & Product Search */}
              <div className="lg:col-span-2 space-y-4">
                {/* Customer Information */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    👤 Customer Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Customer Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g., Juan Dela Cruz"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Contact Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g., 09123456789"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Due Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes..."
                        rows="2"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Product Search */}
                <div className="bg-white rounded-xl border-2 border-gray-200 overflow-visible">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2">
                    <h3 className="text-white font-semibold text-sm">
                      🔍 Add Items to Credit
                    </h3>
                  </div>
                  <div className="p-4">
                    <div className="relative" ref={searchRef}>
                      <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          if (
                            searchTerm.trim().length >= 2 &&
                            searchResults.length > 0
                          ) {
                            setShowSuggestions(true);
                          }
                        }}
                        placeholder="Type product name or barcode..."
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none text-base"
                        autoComplete="off"
                      />
                      <span className="absolute left-3 top-3.5 text-gray-400">
                        🔍
                      </span>

                      {/* Search Suggestions Dropdown - Fixed positioning */}
                      {showSuggestions && searchResults.length > 0 && (
                        <>
                          {/* Backdrop for clicking outside */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowSuggestions(false)}
                          />

                          {/* Suggestions Dropdown - positioned relative to input */}
                          <div
                            className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                            style={{ minWidth: "100%", maxHeight: "400px" }}
                          >
                            <div
                              className="overflow-y-auto"
                              style={{ maxHeight: "360px" }}
                            >
                              {searchResults.map((product, index) => (
                                <div
                                  key={product.id}
                                  onClick={() => {
                                    addToCart(product);
                                    setSearchTerm("");
                                    setShowSuggestions(false);
                                    setSearchResults([]);
                                    inputRef.current?.focus();
                                  }}
                                  className={`p-3 cursor-pointer border-b border-gray-100 transition-all ${
                                    index === selectedSuggestionIndex
                                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                      : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`font-semibold truncate ${index === selectedSuggestionIndex ? "text-white" : "text-gray-800"}`}
                                      >
                                        {product.name}
                                      </p>
                                      <div className="flex gap-3 mt-1 flex-wrap">
                                        {product.barcode && (
                                          <p
                                            className={`text-xs font-mono truncate ${index === selectedSuggestionIndex ? "text-white/80" : "text-gray-400"}`}
                                          >
                                            🔖 {product.barcode}
                                          </p>
                                        )}
                                        <p
                                          className={`text-xs ${index === selectedSuggestionIndex ? "text-white/80" : "text-gray-500"}`}
                                        >
                                          Stock: {product.stock}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                      <p
                                        className={`font-bold text-lg ${index === selectedSuggestionIndex ? "text-white" : "text-green-600"}`}
                                      >
                                        ₱{product.sellingPrice.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 border-t border-gray-200 sticky bottom-0">
                              <span className="flex items-center gap-2 flex-wrap">
                                ⌨️ Type to search • ⬆️⬇️ Navigate • ⏎ Select • ⎋
                                Close
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Quick tip */}
                    <div className="mt-2 text-xs text-gray-400">
                      💡 Type at least 2 characters to see suggestions
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Credit Cart */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden h-full flex flex-col">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3">
                    <h3 className="text-white font-bold flex items-center gap-2">
                      🛒 Credit Cart
                      {cart.length > 0 && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                          items
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[400px] p-4">
                    {cart.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="text-6xl mb-3">🛒</div>
                        <p className="text-gray-400 font-medium">
                          No items added
                        </p>
                        <p className="text-xs text-gray-300 mt-1">
                          Search and select products above
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="border-2 border-gray-100 rounded-xl p-3 hover:shadow-md transition"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-800">
                                  {item.name}
                                </h4>
                                <div className="flex gap-2 mt-1">
                                  <p className="text-xs text-gray-500">
                                    ₱{item.sellingPrice.toFixed(2)} each
                                  </p>
                                  {item.barcode && (
                                    <p className="text-xs text-gray-400 font-mono">
                                      SKU: {item.barcode}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  updateQuantity(item.id, 0, item.stock)
                                }
                                className="text-gray-400 hover:text-red-500 transition-colors text-xl leading-none"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.id,
                                        item.quantity - 1,
                                        item.stock
                                      )
                                    }
                                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 transition-colors font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleManualQuantityChange(
                                        item.id,
                                        e.target.value,
                                        item.stock
                                      )
                                    }
                                    className="w-14 text-center py-1.5 text-sm font-bold border-0 focus:outline-none focus:ring-2 focus:ring-purple-400"
                                    min="1"
                                    max={item.stock}
                                  />
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.id,
                                        item.quantity + 1,
                                        item.stock
                                      )
                                    }
                                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 transition-colors font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-xs text-gray-500">
                                  Stock: {item.stock} left
                                </span>
                              </div>
                              <p className="font-bold text-gray-800 text-lg">
                                ₱
                                {(item.sellingPrice * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-gray-200 p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-gray-700 text-lg">
                        Total Amount:
                      </span>
                      <span className="text-2xl font-bold text-purple-600">
                        ₱{totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={handleSaveCredit}
                      disabled={!customerName.trim() || cart.length === 0}
                      className={`w-full py-3 rounded-xl font-bold transition-all ${
                        !customerName.trim() || cart.length === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:scale-105"
                      }`}
                    >
                      💾 Save Credit Record
                    </button>
                    {cart.length > 0 && (
                      <button
                        onClick={handleClearCart}
                        className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-red-500 transition"
                      >
                        Clear Cart
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Credit List View */
          <div className="flex-1 overflow-y-auto p-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                <p className="text-blue-100 text-xs">Total Credits</p>
                <p className="text-2xl font-bold">₱{totalCredits.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                <p className="text-green-100 text-xs">Total Paid</p>
                <p className="text-2xl font-bold">₱{totalPaid.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                <p className="text-orange-100 text-xs">Pending Balance</p>
                <p className="text-2xl font-bold">₱{totalPending.toFixed(2)}</p>
              </div>
            </div>

            {/* Filter */}
            <div className="mb-4 flex justify-end">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-400 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Credit Records */}
            <div className="space-y-3">
              {filteredCredits.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-3">📝</div>
                  <p className="text-gray-400">No credit records found</p>
                </div>
              ) : (
                filteredCredits.map((credit) => {
                  const remainingBalance = getRemainingBalance(credit);
                  const isOverdue =
                    credit.dueDate &&
                    new Date(credit.dueDate) < new Date() &&
                    credit.status !== "paid";

                  return (
                    <div
                      key={credit.id}
                      className={`border-2 rounded-xl p-4 hover:shadow-lg transition ${
                        isOverdue
                          ? "border-red-300 bg-red-50/30"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-800 text-lg">
                              {credit.customerName}
                            </h3>
                            {getStatusBadge(credit.status)}
                            {isOverdue && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                ⏰ Overdue
                              </span>
                            )}
                          </div>
                          {credit.customerPhone && (
                            <p className="text-xs text-gray-500 mt-1">
                              📞 {credit.customerPhone}
                            </p>
                          )}
                        </div>
                        {credit.status !== "paid" && (
                          <button
                            onClick={() => {
                              setSelectedCredit(credit);
                              setShowPaymentModal(true);
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition"
                          >
                            💵 Add Payment
                          </button>
                        )}

                        {/* Add Cancel Button - Always show for unpaid/partial, optionally for paid */}
                        {(credit.status === 'unpaid' || credit.status === 'partial') && (
                        <button
                            onClick={() => handleCancelCredit(credit)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition"
                        >
                            🗑️ Cancel Credit
                        </button>
                        )}
                      </div>

                      {/* Items List */}
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-bold text-gray-600 mb-2">
                          Items:
                        </p>
                        <div className="space-y-1">
                          {credit.items &&
                            credit.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between text-sm"
                              >
                                <span>
                                  {item.name} x{item.quantity}
                                </span>
                                <span className="font-semibold">
                                  ₱{item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Total Amount</p>
                          <p className="font-bold text-gray-800">
                            ₱{credit.amount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Paid Amount</p>
                          <p className="font-semibold text-green-600">
                            ₱{(credit.paidAmount || 0).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Balance</p>
                          <p
                            className={`font-bold ${remainingBalance > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            ₱{remainingBalance.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Due Date</p>
                          <p className="text-sm">
                            {credit.dueDate
                              ? new Date(credit.dueDate).toLocaleDateString()
                              : "No due date"}
                          </p>
                        </div>
                      </div>

                      {credit.notes && (
                        <div className="mt-2 text-xs text-gray-500">
                          📝 {credit.notes}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-gray-400">
                        {new Date(credit.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedCredit && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPaymentModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 rounded-t-2xl">
                <h3 className="text-white font-bold text-lg">💵 Add Payment</h3>
                <p className="text-white/80">
                  Customer: {selectedCredit.customerName}
                </p>
              </div>

              <div className="p-6">
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Remaining Balance</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₱{getRemainingBalance(selectedCredit).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                    Payment Amount (₱)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none text-lg font-semibold"
                    autoFocus
                  />
                </div>

                {paymentAmount &&
                  Number(paymentAmount) >
                    getRemainingBalance(selectedCredit) && (
                    <p className="text-xs text-red-500 mt-2">
                      ⚠️ Payment exceeds remaining balance
                    </p>
                  )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() =>
                      handleAddPayment(selectedCredit, paymentAmount)
                    }
                    disabled={
                      !paymentAmount ||
                      Number(paymentAmount) <= 0 ||
                      Number(paymentAmount) >
                        getRemainingBalance(selectedCredit)
                    }
                    className={`flex-1 py-3 rounded-xl font-bold transition ${
                      !paymentAmount ||
                      Number(paymentAmount) <= 0 ||
                      Number(paymentAmount) >
                        getRemainingBalance(selectedCredit)
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg"
                    }`}
                  >
                    Record Payment
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentAmount("");
                      setSelectedCredit(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
