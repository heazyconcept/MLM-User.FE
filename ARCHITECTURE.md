# MLM User App — Plain-Language Explanation

**For clients and stakeholders.** This document explains what the application is, what each part does, and how users move through it—without technical jargon.

---

## What This App Is

The app is a **web application for MLM (multi-level marketing) members**. It lets users:

- **Sign up and log in** and complete their profile (onboarding).
- **See a personal dashboard** with their earnings, wallet balance, and recent activity.
- **Manage their wallet** (view balances, see transactions, request withdrawals).
- **Build and view their network** (referral link, team structure, downline, performance).
- **Track earnings and commissions** (overview, breakdown, bonuses, rank, milestones).
- **Shop in the marketplace** and **track orders**.
- **Get notifications** and **control settings** (account, security, preferences).
- **Use a Merchant area** (if they are sellers) to manage inventory, orders, deliveries, and earnings.

Everything is built so that when a real backend is connected later, the same flows and screens can work with live data.

---

## How the App Is Organized

### Three types of “layout”

Depending on where the user is, the screen looks different:

1. **Login / Register / Forgot password / Verify**  
   Full-screen pages with no main menu. The user is not yet (or no longer) logged in.

2. **Onboarding**  
   A focused flow: one card in the center with a step-by-step guide (Profile → Contact → Identity → Bank → Preferences). Used right after sign-up to collect the user’s details.  

3. **Everything after login (Dashboard and all features)**  
   The same “shell”: a **main menu on the left** (and a top header with user and notifications). The main area in the middle shows whichever section the user chose (Dashboard, Wallet, Network, etc.). This keeps navigation consistent.

### How navigation works

- The app opens on **Login**. From there users can register, reset password, or verify their account.
- After login, users land on the **Dashboard**. From the **main menu** they can go to:
  - **Dashboard** — home overview  
  - **Profile** — view/edit profile  
  - **Marketplace** — browse and buy products  
  - **Wallet** — balances and transaction history  
  - **Network** — referral link, team structure, downline, performance  
  - **Commissions** — earnings overview, breakdown, bonuses, rank, milestones  
  - **Transactions** — all transactions in one list  
  - **Withdrawals** — request and track withdrawals  
  - **Orders** — list and details of their orders  
  - **Notifications** — list and preferences  
  - **Settings** — account, security, preferences, sessions  
  - **Merchant Center** — only if the user is a merchant (inventory, orders, deliveries, earnings)

Some menu items are only useful after the user has paid the registration fee; those can be shown as disabled until then. The Merchant section is only visible for users who have the merchant role.

---

## What Each Part of the App Does

### 1. Sign-in and account setup (Authentication & Onboarding)

**What it’s for:**  
To identify the user and collect the information the business needs.

**What the user sees and does:**

- **Login** — Lets the user enter their email and password to sign in. Options include "remember me" to stay logged in on the device, "forgot password" to recover access, and a link to register if they don't have an account. This is the main entry point for returning users.
- **Register** — Allows new users to create an account by entering their name, email, phone, password, sponsor (referrer), and package. After submitting, they receive a verification code (e.g. OTP) to confirm their identity before the account is fully activated.
- **Forgot password / Reset password** — Lets users who forgot their password request a reset link by email. They then land on a page to enter a new password and confirm it. Once completed, they can log in with the new password.
- **Verify** — Lets users enter the verification code (e.g. 6-digit OTP) sent to their email or phone after registration. This confirms they own the contact details and completes account activation.

After first-time sign-up, the user may go through **Onboarding**: a short wizard (Profile → Contact → Identity → Bank → Preferences) so the platform has their contact details, identity info, bank details, and preferences. The progress is shown with a stepper so the user knows how many steps are left.

---

### 2. Dashboard

**What it’s for:**  
The user’s home base after login: a quick overview of what matters most.

**What the user sees and does:**

- **Welcome and status summary** — Shows a personalised greeting and key status indicators such as payment status (e.g. registration fee paid or unpaid) and profile completion percentage. This helps users see at a glance whether they need to take action (e.g. pay the fee or complete their profile).
- **Registration fee prompt** — If the registration fee is not yet paid, displays a clear call-to-action and a way to pay it (e.g. a button that opens a payment modal or flow). Once paid, the user gains full access to all features such as the marketplace and network.
- **Wallet and earnings snapshot** — Displays a quick summary of wallet balances and total earnings, often by currency (NGN, USD). Users can see their financial position without going into the full Wallet or Commissions sections.
- **Recent activity list** — Shows a feed of recent actions such as earnings posted, wallet funding, withdrawals, and orders placed. Each item typically links to the relevant section (e.g. commissions, wallet, orders) so users can drill down for details.
- **Charts and visuals** — Presents performance data (e.g. sales over time, traffic sources) in simple charts so users can quickly understand trends and activity without reading raw numbers.
- **Shortcuts** — Provides quick links to Wallet, Network, Commissions, Orders, and other main sections so users can jump straight to what they need.

So in one place the user sees “where I stand” and can jump to the right section.

---

### 3. Network and referrals

**What it’s for:**  
To see and grow the user’s referral network and team.

**What the user sees and does:**

- **Network overview** — Gives the user a snapshot of their entire team at a glance: total team size, number of direct referrals (people they personally recruited), current rank (e.g. Silver Director), and CPV summary (personal and team point volume for the cycle). This helps users quickly understand their position in the network and how close they are to rank or bonus targets.
- **Referral link** — Provides the user with a unique personal link and referral code to share with others. With a simple copy action, they can share it via messaging, social media, or in person so new members can sign up under them. This is the primary tool for growing the user’s downline and earning referral-based commissions.
- **Matrix tree** — Displays a visual map of the network structure, showing who is under whom and how members are connected across levels. Users can see their placement as the root and expand the tree to view their direct referrals and their referrals’ referrals. This helps users understand their team layout and spot growth opportunities or empty slots.
- **Downline list** — Lets the user view a detailed list of all their downline (recruited) members, showing important information like when each member joined, their current status in the network, and their hierarchical level. This helps users easily track and manage their team’s composition and progress.
- **Performance** — Shows activity and volume metrics such as personal CPV, team CPV, and progress toward required CPV for the current cycle. Users can see how their volume contributes to rank and bonus qualification, and what they need to hit next to unlock rewards or advance in the system.

This whole section is about “my team and how I grow it.”
    
---

### 4. Wallet and withdrawals

**What it’s for:**  
To see money (e.g. in different currencies and types: cash, voucher, autoship) and to withdraw.

**What the user sees and does:**

- **Wallet overview** — Shows balances for each currency (e.g. NGN, USD) and for each type (cash, voucher, autoship), with quick actions such as "View transactions" or "Withdraw." Users can see at a glance how much they have available and where their money is allocated.
- **Transaction history** — Displays a list of all movements (deposits, commissions, withdrawals, payments) for a chosen currency. Users can filter by date, type, or status to find specific transactions. This helps them track where their money came from and where it went.
- **Withdrawals** — Lets users see their withdrawable balance, submit a withdrawal request by entering amount and bank details, and view the history of past requests (pending, approved, or rejected). Users receive feedback when a request is submitted and when it is processed.

**Wallet types (what they're for):**

- **Cash** — Withdrawable money from commissions and other earnings. Can be withdrawn to the user's bank account or used to pay for products in the marketplace.
- **Voucher** — Credit earned (e.g. from bonuses or rewards) that can be used to buy products in the marketplace but is typically not withdrawable as cash.
- **Autoship** — Balance reserved for recurring (e.g. monthly) product orders. Used to pay for subscription or autoship purchases so the user doesn't have to pay each time manually.

So: “How much do I have, what happened to my money, and how do I withdraw?”

---

### 5. Earnings and commissions

**What it’s for:**  
To understand how much the user has earned and how (by type, bonus, rank, milestones).

**What the user sees and does:**

- **Earnings overview** — Gives users a summary of their total earnings, often split by currency and by type (e.g. direct referral, community, product, matching). They can see lifetime totals, pending vs approved amounts, and how their earnings have trended over time. This answers the core question: "How much have I earned?"
- **Commission breakdown** — Shows a detailed list of every commission entry: date, type (e.g. Direct Referral, Community Bonus), source (person or order), amount, currency, and status (Pending, Approved, Locked). Users can review each earning and understand exactly where their money came from.
- **Bonuses** — Different bonus types, whether they’re qualified, and amounts (earned or locked).
- **Ranking** — Current rank/stage, progress to next rank, and what’s required.
- **CPV milestones** — Shows total, personal, and team CPV (Cumulative Point Volume), progress toward the next milestone, and a list of milestones with rewards (e.g. ₦10,000 at 2500 CPV). Achieved milestones are marked with dates; upcoming ones show how many points are still needed. This motivates users by making rewards visible and attainable.

This section answers: “How much have I earned and why?”

---

### 6. Marketplace and orders

**What it’s for:**  
To browse and buy products, and to track orders.

**What the user sees and does:**

- **Marketplace** — Displays a grid of products with filters by category, search, and sort options (e.g. by name, price, point value). Users can browse, filter, and click a product to see full details. This is the main shopping area where users discover what they can buy.
- **Product detail** — Shows full product information including name, description, price, point value (PV), images, and eligibility (e.g. which wallets can pay for it). Users can add to cart or proceed to purchase, depending on implementation. This helps users make informed purchase decisions.
- **Orders list** — Lists all of the user's orders with filters (e.g. by status: Pending, Processing, Ready for Pickup, Out for Delivery, Delivered, Cancelled). Users can search by order ID or product name and click an order to see its full details. This helps them track all purchases in one place.
- **Order preview** — Appears before final confirmation so users can choose how they want to receive the order: pickup at a location or delivery to an address. Users see the fulfilment options, any delivery fee, and can confirm or go back. This ensures they select the right fulfilment method before committing.
- **Order detail** — Shows a single order in full: items, quantities, prices, total, fulfilment method (pickup or delivery), address or pickup location, status, and a timeline of updates. Users can see the current stage (e.g. Processing, Out for Delivery) and take any available actions. This helps users track a specific order from placement to delivery.

So: “What can I buy?” and “Where are my orders?”

---

### 7. Notifications and settings

**What it’s for:**  
To stay informed and to control account and app preferences.

**What the user sees and does:**

- **Notifications list** — Shows all notifications grouped or filterable by category (e.g. earnings, wallet, orders, system). Users can mark individual items as read, mark all as read, or clear the list. Each notification typically shows a title, message, and optional link to the relevant section. This helps users stay on top of important updates without missing anything.
- **Notification preferences** — Lets users control which notifications they receive by turning categories on or off (e.g. earnings, wallet, orders, network, system). They can choose how they want to be notified (e.g. email, push) per category. This ensures users get the updates they care about without being overloaded.
- **Settings** — Provides a single place to manage account and app preferences, with sub-sections:
  - **Account** — View and edit profile and account information such as name, email, phone, address, and bank details. Users can keep their information up to date for payments and communications.
  - **Security** — Change password and, if offered, enable or manage two-factor authentication (2FA). This helps users protect their account from unauthorised access.
  - **Preferences** — Adjust app-level settings such as language, theme (light/dark), and other display options. Users can personalise how the app looks and behaves for them.
  - **Sessions** — View active sessions (e.g. devices or browsers where the user is logged in) and log out from other devices if supported. This helps users manage access and revoke sessions they no longer recognise.

So: “What did I miss?” and “How do I control my account and preferences?”

---

### 8. Merchant area

**What it’s for:**  
For users who are also **sellers**: manage what they sell and fulfil orders.

**What the user sees and does:**

- **Merchant dashboard** — Gives merchants a snapshot of their business: total sales, number of pending fulfilments (orders waiting to be processed or delivered), inventory alerts (e.g. low stock or out-of-stock items), and earnings. This helps merchants quickly see what needs attention and how their store is performing.
- **Inventory** — Lists all products the merchant sells with current stock levels and status (e.g. In Stock, Low, Out). Merchants can update stock quantities when they receive or sell inventory. This helps them avoid overselling and keep stock accurate for customers.
- **Orders** — Displays a list of incoming orders from customers. Merchants can filter by status and open any order to see details and take fulfilment actions. This is where they manage what needs to be processed, packed, and shipped or made ready for pickup.
- **Order detail (merchant)** — Shows one order in full: items, quantities, customer name and contact, delivery address or pickup location, and fulfilment status. Merchants can take actions such as mark as Processing, Ready for Pickup, Out for Delivery, or Delivered. This lets them progress each order through the fulfilment pipeline.
- **Deliveries** — Lets merchants track delivery status for orders: Pending (not yet assigned), Assigned (courier or fulfilment assigned), In Transit, or Delivered. They can see customer address and contact for each delivery. This helps them coordinate logistics and keep customers informed.
- **Earnings** — Shows what the merchant has earned from their store: sales commissions, delivery bonuses, and total earnings. This helps merchant users understand their income from the platform and track their performance as sellers.

This part is only visible and usable for users who have the **merchant role**. It answers: “What do I sell, what do I need to fulfil, and how much did I earn as a seller?”

---

## How Users Move Through the App

### New user (typical path)

1. Opens the app → sees **Login** (or chooses Register).
2. **Registers** (name, email, password, etc.) → may get a **verification** step (e.g. OTP).
3. After verification → may be sent to **Onboarding** (profile, contact, identity, bank, preferences).
4. After onboarding → lands on **Dashboard**.
5. If registration fee is required → sees a prompt on the dashboard and can **pay** (e.g. via a modal or dedicated step).
6. After that → can use **Marketplace**, **Wallet**, **Network**, **Commissions**, **Orders**, etc. from the main menu.

### Returning user

1. Opens the app → **Login** (email + password).
2. Lands on **Dashboard** and from there goes to any section (Wallet, Network, Commissions, Orders, Settings, etc.).
3. When done → **Log out** from the menu or header; next time they see Login again.

### Typical actions from the dashboard

- **Check balance or withdraw** → Wallet → Transaction history or Withdrawals.
- **Share referral link** → Network → Referrals.
- **See team structure** → Network → Matrix or Downline.
- **Check earnings** → Commissions → Overview, Breakdown, Bonuses, or Rank.
- **Shop** → Marketplace → product → (add to cart / checkout) → Orders.
- **Track an order** → Orders → open the order to see status and details.
- **Change password or preferences** → Settings → Security or Preferences.
- **Merchant:** manage stock and orders → Merchant Center → Inventory or Orders.

---

## How Information Is Kept (In Simple Terms)

- **While the user is logged in:**  
  The app “remembers” who they are, their payment status, profile, and (where implemented) things like wallet balances, withdrawal history, commissions, and notification preferences. So when they move from Dashboard to Wallet to Network, they don’t have to log in again and the numbers stay consistent.

- **After they close the browser and come back:**  
  Some data is **saved in the browser** (e.g. that they’re logged in, their profile, payment status, wallet and withdrawal history, commissions, notification list and preferences). So when they return and log in again (or if the session is still valid), they see their data as before. Other data (e.g. product list, current orders, network structure) may be **reloaded from the server** when the app talks to a real backend; until then, the app can show sample/demo data.

- **When they log out:**  
  Their session is cleared so the next person using the device cannot see their account. What is stored in the browser (e.g. saved login token or preferences) depends on implementation; typically at least the “logged in” state is removed so they must log in again.

- **Future backend:**  
  The app is built so that later, when it is connected to your real servers, the same screens and flows can show and update **live** data (wallets, commissions, orders, inventory, etc.) instead of demo or locally saved data. The way the app is structured (clear sections and flows) makes this integration straightforward.

---

## Summary for the Client

- The app is a **member-facing MLM platform**: login, onboarding, dashboard, wallet, network, commissions, marketplace, orders, notifications, settings, and (for sellers) a merchant area.
- **Three layouts:** login/register (full screen), onboarding (wizard), and main app (menu + header + content). Navigation is consistent once the user is inside the app.
- **Each section has a clear purpose** for the user (e.g. “see my wallet,” “share my link,” “track earnings,” “manage my orders,” “manage my merchant business”).
- **User journey** is simple: sign up → verify → onboarding → dashboard → use any feature from the menu; returning users log in and go straight to the dashboard.
- **Data** is remembered during the session and, where implemented, partly in the browser so it persists between visits; the design allows switching to a real backend later without changing the way users experience the app.

If you need the same content in another format (e.g. a one-pager for executives or a slide outline), say how you’d like it shortened or focused (e.g. “only flows” or “only features”).

