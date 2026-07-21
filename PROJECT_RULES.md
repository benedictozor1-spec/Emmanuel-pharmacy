# 🏥 Emmanuel Pharmacy — Context Rules & Guidelines

> **Project Goal**: A modern, high-performance Progressive Web Application (PWA) for **Emmanuel Pharmacy**, providing seamless Point-of-Sale (POS), inventory control, split-payment processing, daily expense logging, and role-based operations (Admin, Cashier, Attendant).

---

## 1. 🛠️ Technology Stack Rules

* **Frontend Framework**: React 19 with Vite ([vite.config.js](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/vite.config.js)).
* **Routing**: React Router v7 (`react-router-dom`).
* **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) + custom CSS variables in [index.css](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/index.css).
* **Backend & Database**: Supabase (`@supabase/supabase-js`) using PostgreSQL + Row Level Security (RLS).
* **PWA & Offline Capability**: `vite-plugin-pwa` for service worker management and caching assets.
* **Code Quality**: Oxlint ([.oxlintrc.json](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/.oxlintrc.json)) for fast linting.

---

## 2. 👥 Role-Based Architecture & Access Control

The app enforces strict role-based views based on the `profiles.role` table column in Supabase:

1. **`admin`**: Full system control.
   - Access to [AdminPage.jsx](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/pages/AdminPage.jsx).
   - Inventory creation/updates, supplier management, price adjustments, staff user creation, financial reporting, and system audit logs.
2. **`cashier`**: Checkout & payment operations.
   - Access to [CashierPage.jsx](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/pages/CashierPage.jsx).
   - Order payment processing (Cash, Card, Transfer, Split Payments), daily register balancing, cash expense logging, receipt generation.
3. **`attendant`**: Sales floor & patient support.
   - Access to [AttendantPage.jsx](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/pages/AttendantPage.jsx).
   - Cart assembly, stock check, preliminary prescription/treatment logging, pending order creation.

* **Rule**: Never expose administrative functionality or direct table mutation routes to non-admin roles. Always check active role state before rendering sensitive panels or performing Supabase mutations.

---

## 3. 💾 Data Model & Supabase Guidelines

### Key Tables & Schema Rules
* **`profiles`**: `id`, `full_name`, `role` (`admin`, `cashier`, `attendant`), `email`, `created_at`.
* **`products`**: `id`, `name`, `category`, `barcode`, `unit_price`, `cost_price`, `stock_quantity`, `reorder_level`, `expiry_date`, `batch_number`.
* **`orders`**: `id`, `receipt_ref`, `total_amount`, `status` (`pending`, `paid`, `cancelled`, `dispensed`), `payment_method` (`cash`, `card`, `transfer`, `split`), `cashier_id`, `created_at`, `paid_at`.
* **`order_items`**: `id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`.
* **`expenses`**: `id`, `cashier_id`, `category`, `amount`, `description`, `created_at`.
* **`treatments`**: `id`, `patient_name`, `attendant_id`, `symptoms`, `prescription_notes`, `created_at`.

### Supabase Operational Rules
1. **Receipt Reference Standard**: Every completed order must generate a unique, formatted reference: `EP-YYYYMMDD-XXXX` (e.g. `EP-20260721-0012`).
2. **Atomic Payment & Stock Updates**: Stock deductions must coincide with order finalization. Always verify `stock_quantity >= order_quantity` before finalizing checkout.
3. **Split Payment Tracking**: When processing split payments, store the breakdown clearly (e.g. `cash_amount`, `card_amount`, `transfer_amount`) in the database metadata.
4. **Row Level Security (RLS)**: Ensure RLS policies are enabled on all Supabase tables (`supabase/migrations`).

---

## 4. 🎨 Design System & UI/UX Standards

1. **Aesthetic Style**: Premium Dark Mode theme with an emerald green (`emerald-500` / `emerald-600`) medical/pharmacy primary accent.
2. **Typography & Hierarchy**: Clean sans-serif fonts (e.g., Inter / Outfit). High visual contrast for fast readability in busy store environments.
3. **Touch-Friendly POS**: Large action buttons, clear search inputs, and touch-optimised cart list items for tablet/touchscreen use.
4. **Status Indicators**:
   - 🟢 **Paid / In Stock / Normal** (`emerald-500`)
   - 🟡 **Low Stock / Expiring Soon / Pending** (`amber-500`)
   - 🔴 **Out of Stock / Expired / Cancelled** (`rose-500`)

---

## 5. 📁 Project Structure & Code Conventions

```
src/
├── assets/          # Icons, logos, and static media
├── components/      # Shared UI elements (Modal, Navbar, MetricCard, Table, Toast)
├── contexts/        # React Contexts (AuthContext, CartContext, ThemeContext)
├── hooks/           # Custom hooks (useInventory, useOrders, useSupabase)
├── lib/             # Supabase client (supabase.js), formatters & helpers
├── pages/           # Primary views (LoginPage, AdminPage, CashierPage, AttendantPage)
├── App.jsx          # Router configuration and Role Guards
└── main.jsx         # Application entry point
```

### Development Rules
* **Environment Variables**: Use `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` stored in `.env`. Never commit secrets or hardcoded Supabase keys.
* **Component Modularity**: Keep components focused. Large page files like [AdminPage.jsx](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/pages/AdminPage.jsx) or [CashierPage.jsx](file:///c:/Users/OZOR%20CHIDIEBERE/Desktop/Emmanuel%20Pharmacy/src/pages/CashierPage.jsx) should delegate sub-sections to dedicated component modules.
* **Error Handling**: Use explicit visual toast notifications or feedback alerts for failed database actions (e.g., payment failures, network disconnects, insufficient stock).
