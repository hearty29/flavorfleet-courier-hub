import React from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Trophy, Shield, Bike, Receipt } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo / Title */}
        <Link to="/food" className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-orange-700 tracking-tight">
            Roadside <span className="text-slate-800">Paddles</span>
          </span>
        </Link>

        {/* Navigation Icons */}
        <div className="flex items-center gap-3 sm:gap-4 text-slate-600">
          <Link
            to="/pickleball"
            className="flex items-center gap-1 text-xs font-semibold hover:text-orange-600 transition"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Pickleball</span>
          </Link>

          <Link
            to="/rider"
            className="flex items-center gap-1 text-xs font-semibold hover:text-orange-600 transition"
          >
            <Bike className="w-4 h-4" />
            <span className="hidden sm:inline">Rider</span>
          </Link>

          <Link
            to="/orders"
            className="flex items-center gap-1 text-xs font-semibold hover:text-orange-600 transition"
          >
            <Receipt className="w-4 h-4" />
            <span className="hidden sm:inline">Orders</span>
          </Link>

          {/* FIXED CART ICON LINK (Points to /checkout instead of /cart) */}
          <Link
            to="/checkout"
            className="relative p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition flex items-center justify-center"
          >
            <ShoppingBag className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
