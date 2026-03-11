import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { token, user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [age, setAge] = useState(user?.age || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [address, setAddress] = useState(user?.address || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setFirstName(user?.firstName || "");
    setLastName(user?.lastName || "");
    setAge(user?.age || "");
    setGender(user?.gender || "");
    setAddress(user?.address || "");
    setWebsite(user?.website || "");
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.updateMe(
        {
          firstName,
          lastName,
          age: Number(age),
          gender,
          address,
          website,
        },
        token
      );
      await refreshProfile();
      navigate("/?profileUpdated=1");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel page">
      <h1>Your Profile</h1>
      <p className="muted">Keep your profile complete so other users can identify you.</p>
      <form onSubmit={onSubmit} className="form two-col">
        <label className="field">
          <span className="form-label">User Name</span>
          <input value={user?.displayName || ""} readOnly placeholder="User Name" />
        </label>
        <label className="field">
          <span className="form-label">Email</span>
          <input value={user?.email || ""} readOnly placeholder="email" />
        </label>
        <label className="field">
          <span className="form-label">First Name</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required />
        </label>
        <label className="field">
          <span className="form-label">Last Name</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required />
        </label>
        <label className="field">
          <span className="form-label">Age</span>
          <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" required />
        </label>
        <label className="field">
          <span className="form-label">Gender</span>
          <input value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Gender" required />
        </label>
        <label className="field">
          <span className="form-label">Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" required />
        </label>
        <label className="field">
          <span className="form-label">Website</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" />
        </label>
        {error && <p className="error form-note">{error}</p>}
        <button className="form-note" type="submit">Update Profile</button>
      </form>
    </section>
  );
}
