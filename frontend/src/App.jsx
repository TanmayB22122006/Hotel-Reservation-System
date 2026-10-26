import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "./App.css";

// Components
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { RoomCard } from "./components/RoomCard";
import { BookingModal } from "./components/BookingModal";
import { AuthModal } from "./components/AuthModal";
import { AdminPanel } from "./components/AdminPanel";
import { MyBookings } from "./components/MyBookings";
import { Amenities } from "./components/Amenities";
import { Reviews } from "./components/Reviews";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";
import { ApiSettingsModal } from "./components/ApiSettingsModal";
import { IconSearch, IconBed } from "./components/Icons";

// Default Data & Constants
import { DEFAULT_FALLBACK_ROOMS } from "./data/roomData";

const INITIAL_API = localStorage.getItem("aura_hotel_api") || "http://localhost:5000/api";

function App() {
  const [apiEndpoint, setApiEndpoint] = useState(INITIAL_API);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [page, setPage] = useState("home"); // "home" | "rooms" | "amenities" | "reviews" | "my-bookings" | "admin"

  // App Data
  const [rooms, setRooms] = useState(DEFAULT_FALLBACK_ROOMS);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("aura_logged_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Modals & Overlays
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [authModal, setAuthModal] = useState(null); // null | "login" | "register"
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Room filters
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState("default");

  // Show Toast Helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  // Load Rooms from backend
  const loadRooms = async (targetApi = apiEndpoint) => {
    try {
      const response = await axios.get(`${targetApi}/rooms`, { timeout: 4000 });
      if (Array.isArray(response.data) && response.data.length > 0) {
        setRooms(response.data);
      } else {
        setRooms(DEFAULT_FALLBACK_ROOMS);
      }
      setIsApiOnline(true);
    } catch (err) {
      console.warn("Backend API not reachable at", targetApi, err.message);
      setIsApiOnline(false);
      // Fallback to initial rooms so UI is never blank
      setRooms((prev) => (prev.length > 0 ? prev : DEFAULT_FALLBACK_ROOMS));
    }
  };

  // Load Admin Data (Bookings & Users)
  const loadAdminData = async () => {
    try {
      const [bookingsRes, usersRes] = await Promise.allSettled([
        axios.get(`${apiEndpoint}/bookings`, { timeout: 4000 }),
        axios.get(`${apiEndpoint}/users`, { timeout: 4000 })
      ]);

      if (bookingsRes.status === "fulfilled") {
        setBookings(bookingsRes.value.data || []);
      }
      if (usersRes.status === "fulfilled") {
        setUsers(usersRes.value.data || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    }
  };

  // Trigger loads on mount & API endpoint change
  useEffect(() => {
    loadRooms(apiEndpoint);
  }, [apiEndpoint]);

  useEffect(() => {
    if (page === "admin" && user?.role === "admin") {
      loadAdminData();
    }
    if (page === "my-bookings" && user) {
      axios
        .get(`${apiEndpoint}/bookings`, { timeout: 4000 })
        .then((res) => setBookings(res.data || []))
        .catch(() => {});
    }
  }, [page, user, apiEndpoint]);

  // Handle Switch API Endpoint
  const handleSaveApiEndpoint = (newUrl) => {
    setApiEndpoint(newUrl);
    localStorage.setItem("aura_hotel_api", newUrl);
    loadRooms(newUrl);
    showToast(`API endpoint updated to ${newUrl}`, "info");
  };

  // ================= AUTHENTICATION ================= //
  const handleRegister = async ({ name, email, password, photoFile }) => {
    setIsSubmitting(true);
    try {
      // Build multipart/form-data so multer-s3 can receive the optional photo
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("role", "guest");
      if (photoFile) {
        formData.append("profilePhoto", photoFile);
      }

      const res = await axios.post(`${apiEndpoint}/users/register`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      showToast(res.data?.message || "Account registered successfully! Please sign in.");
      setAuthModal("login");
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Registration failed. Please check inputs.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async ({ email, password }) => {
    setIsSubmitting(true);
    try {
      const loginRes = await axios.post(`${apiEndpoint}/users/login`, {
        email,
        password
      });

      if (loginRes.data?.token) {
        localStorage.setItem("token", loginRes.data.token);
      }

      // Fetch users list to retrieve logged-in user profile details (as in original code)
      const usersRes = await axios.get(`${apiEndpoint}/users`);
      const matchedUser = usersRes.data.find((item) => item.email.toLowerCase() === email.toLowerCase());

      if (matchedUser) {
        // Fetch pre-signed photo URL if the user has a profile photo stored in S3
        let photoUrl = null;
        if (matchedUser.profilePhotoKey && matchedUser.id) {
          try {
            const photoRes = await axios.get(`${apiEndpoint}/users/${matchedUser.id}/photo`, { timeout: 5000 });
            photoUrl = photoRes.data?.url || null;
          } catch (photoErr) {
            // Non-fatal: photo URL fetch failure should not block login
            console.warn("Could not fetch profile photo URL:", photoErr.response?.data?.message || photoErr.message);
          }
        }

        const userWithPhoto = { ...matchedUser, photoUrl };
        setUser(userWithPhoto);
        localStorage.setItem("aura_logged_user", JSON.stringify(userWithPhoto));
        showToast(`Welcome back, ${matchedUser.name}!`);
        setAuthModal(null);

        if (matchedUser.role === "admin") {
          setPage("admin");
        } else {
          setPage("home");
        }
      } else {
        // Fallback user object if not found in table
        const fallbackUser = { id: 99, name: email.split("@")[0], email, role: "guest", photoUrl: null };
        setUser(fallbackUser);
        localStorage.setItem("aura_logged_user", JSON.stringify(fallbackUser));
        showToast(`Signed in as ${fallbackUser.name}`);
        setAuthModal(null);
      }
    } catch (err) {
      console.error(err);
      // If backend is offline but user wants to demo login:
      if (!isApiOnline) {
        const demoUser = email.includes("admin")
          ? { id: 1, name: "Admin Manager", email, role: "admin", photoUrl: null }
          : { id: 2, name: "Guest Traveler", email, role: "guest", photoUrl: null };
        setUser(demoUser);
        localStorage.setItem("aura_logged_user", JSON.stringify(demoUser));
        showToast(`Offline Demo Session: Signed in as ${demoUser.role.toUpperCase()}`);
        setAuthModal(null);
        if (demoUser.role === "admin") setPage("admin");
      } else {
        showToast(err.response?.data?.message || "Invalid email or password", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("aura_logged_user");
    setUser(null);
    setPage("home");
    showToast("You have been signed out safely.", "info");
  };

  // ================= BOOKING ACTIONS ================= //
  const handleOpenBooking = (room) => {
    if (!user) {
      showToast("Please sign in or create an account to reserve a room.", "info");
      setAuthModal("login");
      return;
    }
    setSelectedRoom(room);
  };

  const handleSubmitBooking = async (bookingData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...bookingData,
        room_id: selectedRoom.id
      };

      const res = await axios.post(`${apiEndpoint}/bookings`, payload);
      showToast(res.data?.message || `Room ${selectedRoom.room_number} booked successfully!`);
      setSelectedRoom(null);
      loadRooms();

      // If user is guest, navigate to my-bookings to view confirmation
      setPage("my-bookings");
    } catch (err) {
      console.error(err);
      if (!isApiOnline) {
        // Simulated booking for offline/demo evaluation
        const simulatedBooking = {
          id: Date.now(),
          guest_name: bookingData.guest_name,
          email: bookingData.email,
          room_id: selectedRoom.id,
          room_number: selectedRoom.room_number,
          room_type: selectedRoom.room_type,
          price: selectedRoom.price,
          check_in: bookingData.check_in,
          check_out: bookingData.check_out,
          status: "Confirmed"
        };
        setBookings((prev) => [simulatedBooking, ...prev]);
        setRooms((prev) =>
          prev.map((r) => (r.id === selectedRoom.id ? { ...r, status: "Booked" } : r))
        );
        showToast(`Reservation Confirmed for Room ${selectedRoom.room_number}! (Offline Demo)`);
        setSelectedRoom(null);
        setPage("my-bookings");
      } else {
        showToast(err.response?.data?.message || "Booking failed. Please try again.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await axios.put(`${apiEndpoint}/bookings/${bookingId}`, { status: "Cancelled" });
      showToast("Booking has been cancelled.");
      // Reload bookings & rooms
      loadAdminData();
      loadRooms();
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "Cancelled" } : b))
      );
    } catch (err) {
      console.error(err);
      // Offline fallback
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "Cancelled" } : b))
      );
      showToast("Booking marked as Cancelled.");
    }
  };

  // ================= ADMIN ACTIONS ================= //
  const handleAddRoom = async (roomData) => {
    try {
      const res = await axios.post(`${apiEndpoint}/rooms`, roomData);
      showToast(res.data?.message || "New room added successfully!");
      loadRooms();
    } catch (err) {
      console.error(err);
      // Fallback
      const newRoom = { id: Date.now(), ...roomData };
      setRooms((prev) => [...prev, newRoom]);
      showToast("Room added to catalog.");
    }
  };

  const handleUpdateRoom = async (roomId, updatePayload) => {
    try {
      await axios.put(`${apiEndpoint}/rooms/${roomId}`, updatePayload);
      showToast("Room updated successfully!");
      loadRooms();
    } catch (err) {
      console.error(err);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, ...updatePayload } : r))
      );
      showToast("Room details updated.");
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm("Are you sure you want to delete this room?")) return;
    try {
      await axios.delete(`${apiEndpoint}/rooms/${roomId}`);
      showToast("Room deleted.");
      loadRooms();
    } catch (err) {
      console.error(err);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      showToast("Room deleted from local view.");
    }
  };

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      await axios.put(`${apiEndpoint}/bookings/${bookingId}`, { status: newStatus });
      showToast(`Booking #${bookingId} status updated to ${newStatus}`);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      console.error(err);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      showToast(`Status updated to ${newStatus}`);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm("Delete this reservation?")) return;
    try {
      await axios.delete(`${apiEndpoint}/bookings/${bookingId}`);
      showToast("Booking reservation deleted.");
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      console.error(err);
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      showToast("Reservation removed.");
    }
  };

  const handleUpdateUserRole = async (userId, updatePayload) => {
    try {
      await axios.put(`${apiEndpoint}/users/${userId}`, updatePayload);
      showToast("User role updated successfully!");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updatePayload } : u))
      );
    } catch (err) {
      console.error(err);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...updatePayload } : u))
      );
      showToast("User role updated.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user account?")) return;
    try {
      await axios.delete(`${apiEndpoint}/users/${userId}`);
      showToast("User account removed.");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("User removed.");
    }
  };

  // Quick search from Hero section
  const handleHeroSearch = ({ type }) => {
    if (type && type !== "All") {
      setSelectedCategory(type);
    }
    setPage("rooms");
  };

  // Filtered & Sorted Rooms List
  const filteredRooms = useMemo(() => {
    return rooms
      .filter((room) => {
        const matchesCategory =
          selectedCategory === "All" ||
          room.room_type?.toLowerCase() === selectedCategory.toLowerCase();

        const matchesAvailability = availableOnly ? room.status === "Available" : true;

        const matchesSearch =
          searchQuery === "" ||
          room.room_number?.toString().includes(searchQuery) ||
          room.room_type?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesAvailability && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "room-asc") return a.room_number - b.room_number;
        return 0;
      });
  }, [rooms, selectedCategory, availableOnly, searchQuery, sortBy]);

  return (
    <div className="app-shell light-theme">
      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Navigation */}
      <Navbar
        page={page}
        setPage={setPage}
        user={user}
        onLogout={handleLogout}
        onOpenAuth={(tab) => setAuthModal(tab)}
        apiEndpoint={apiEndpoint}
        onOpenApiSettings={() => setApiSettingsOpen(true)}
        isApiOnline={isApiOnline}
      />

      {/* MAIN VIEW CONTENT */}
      <main className="main-content-flow">
        {page === "home" && (
          <>
            <Hero
              onSearchRooms={handleHeroSearch}
              onExploreClick={() => setPage("rooms")}
            />

            {/* Featured Rooms Showcase Section */}
            <section className="featured-rooms-preview container">
              <div className="section-header-row">
                <div>
                  <span className="section-eyebrow">CURATED RESIDENCES</span>
                  <h2 className="section-title">Signature Rooms & Suites</h2>
                  <p className="section-subtitle">
                    Hand-crafted spaces designed with acoustic tranquility and luxury amenities.
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => setPage("rooms")}>
                  View All Rooms ({rooms.length})
                </button>
              </div>

              <div className="rooms-grid">
                {rooms.slice(0, 3).map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onBook={handleOpenBooking}
                  />
                ))}
              </div>
            </section>

            <Amenities />
            <Reviews />
          </>
        )}

        {page === "rooms" && (
          <section className="rooms-catalog-page container">
            <div className="page-header-row">
              <div>
                <span className="section-eyebrow">ACCOMMODATION DIRECTORY</span>
                <h1 className="page-title">Explore Available Rooms & Suites</h1>
                <p className="page-subtitle">
                  Browse our full inventory, filter by suite category, or search room numbers.
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="catalog-filter-bar">
              {/* Category Pills */}
              <div className="category-pill-group">
                {["All", "Deluxe", "Suite", "Luxury", "Double", "Single"].map((cat) => (
                  <button
                    key={cat}
                    className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search & Secondary Filters */}
              <div className="filter-controls-right">
                <div className="search-input-wrap">
                  <IconSearch size={16} />
                  <input
                    type="text"
                    placeholder="Search room # or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <label className="checkbox-filter-label">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                  />
                  <span>Available Only</span>
                </label>

                <select
                  className="sort-dropdown"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="default">Default Sort</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="room-asc">Room Number</option>
                </select>
              </div>
            </div>

            {/* Results Grid */}
            {filteredRooms.length === 0 ? (
              <div className="empty-catalog-notice">
                <IconBed size={40} />
                <h3>No rooms match your filter criteria</h3>
                <p>Try resetting the category filter or searching for another keyword.</p>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSelectedCategory("All");
                    setAvailableOnly(false);
                    setSearchQuery("");
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="rooms-grid">
                {filteredRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onBook={handleOpenBooking}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {page === "amenities" && <Amenities />}

        {page === "reviews" && <Reviews />}

        {page === "my-bookings" && (
          <MyBookings
            bookings={bookings}
            user={user}
            onExploreRooms={() => setPage("rooms")}
            onCancelBooking={handleCancelBooking}
          />
        )}

        {page === "admin" && user?.role === "admin" && (
          <AdminPanel
            rooms={rooms}
            bookings={bookings}
            users={users}
            onAddRoom={handleAddRoom}
            onUpdateRoom={handleUpdateRoom}
            onDeleteRoom={handleDeleteRoom}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onDeleteBooking={handleDeleteBooking}
            onUpdateUserRole={handleUpdateUserRole}
            onDeleteUser={handleDeleteUser}
            onRefreshData={loadAdminData}
          />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={(dest) => setPage(dest)} />

      {/* Booking Modal */}
      {selectedRoom && (
        <BookingModal
          room={selectedRoom}
          user={user}
          onClose={() => setSelectedRoom(null)}
          onSubmitBooking={handleSubmitBooking}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Authentication Modal */}
      {authModal && (
        <AuthModal
          initialTab={authModal}
          onClose={() => setAuthModal(null)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          isLoading={isSubmitting}
        />
      )}

      {/* API Endpoint Config Modal */}
      {apiSettingsOpen && (
        <ApiSettingsModal
          currentEndpoint={apiEndpoint}
          onSaveEndpoint={handleSaveApiEndpoint}
          onClose={() => setApiSettingsOpen(false)}
          isOnline={isApiOnline}
        />
      )}
    </div>
  );
}

export default App;