// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { db } from "../db";
import toast, { Toaster } from "react-hot-toast";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const INACTIVITY_TIME = 2 * 60 * 60 * 1000; // 2 hours

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        toast.error("Session expired due to inactivity");
        signOut();
      }, INACTIVITY_TIME);
    };

    // User activity events
    const events = [
      "mousemove",
      "mousedown",
      "click",
      "scroll",
      "keypress",
      "touchstart",
    ];

    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Start timer
    resetTimer();

    return () => {
      clearTimeout(timeoutId);

      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const storedUser = localStorage.getItem("pos_user");

    if (storedUser) {
      const lastActivity = localStorage.getItem("last_activity");

      if (lastActivity) {
        const inactiveFor = Date.now() - parseInt(lastActivity, 10);

        if (inactiveFor >= 2 * 60 * 60 * 1000) {
          localStorage.removeItem("pos_user");
          localStorage.removeItem("last_activity");
        } else {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setIsAuthenticated(true);
        }
      }
    }

    setLoading(false);
  }, []);

  const resetTimer = () => {
    localStorage.setItem("last_activity", Date.now().toString());

    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      toast.error("Session expired due to inactivity");
      signOut();
    }, INACTIVITY_TIME);
  };

  const signIn = async (username, password) => {
    try {
      // Query the users table for matching username and password
      const { data, error } = await db
        .from("users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error) {
        console.error("Login query error:", error);
        toast.error("Invalid username or password", {
          duration: 4000,
          position: "top-right",
        });
        return { success: false, error: "Invalid credentials" };
      }

      if (!data) {
        toast.error("Invalid username or password", {
          duration: 4000,
          position: "top-right",
        });
        return { success: false, error: "Invalid credentials" };
      }

      // Store user in localStorage
      const userData = {
        id: data.id,
        name: data.name,
        username: data.username,
        store_id: data.store_id,
      };

      localStorage.setItem("pos_user", JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);

      toast.success(`Welcome back, ${data.name || data.username}! 🎉`, {
        duration: 3000,
        position: "top-right",
      });

      return { success: true, data: userData };
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to sign in. Please try again.", {
        duration: 4000,
        position: "top-right",
      });
      return { success: false, error: error.message };
    }
  };

  const signUp = async (name, username, password) => {
    try {
      // Check if username already exists
      const { data: existingUser, error: checkError } = await db
        .from("users")
        .select("username")
        .eq("username", username)
        .single();

      if (existingUser) {
        toast.error("Username already exists. Please choose another.", {
          duration: 4000,
          position: "top-right",
        });
        return { success: false, error: "Username already exists" };
      }

      // Insert new user
      const { data, error } = await db
        .from("users")
        .insert([
          {
            name: name,
            username: username,
            password: password,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Auto-login after registration
      const userData = {
        id: data.id,
        name: data.name,
        username: data.username,
        store_id: data.store_id,
      };

      localStorage.setItem("pos_user", JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);

      toast.success(`Account created successfully! Welcome, ${data.name}! 🎉`, {
        duration: 3000,
        position: "top-right",
      });

      return { success: true, data: userData };
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(error.message || "Failed to create account", {
        duration: 4000,
        position: "top-right",
      });
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      toast.success("Signed out successfully", {
        duration: 2000,
        position: "top-right",
      });
      localStorage.removeItem("pos_user");
      localStorage.removeItem("last_activity");
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Signout error:", error);
      toast.error("Failed to sign out", {
        duration: 3000,
        position: "top-right",
      });
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
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
      {children}
    </AuthContext.Provider>
  );
};
