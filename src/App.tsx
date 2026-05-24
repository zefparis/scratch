import { Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen';
import ScratchScreen from './screens/ScratchScreen';
import AdminScreen from './screens/AdminScreen';
import BottomNav from './components/BottomNav';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/scratch" element={<ScratchScreen />} />
        <Route path="/games" element={<HomeScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
