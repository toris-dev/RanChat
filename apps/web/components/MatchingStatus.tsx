"use client";

import { Users, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

interface MatchingStatusProps {
  onlineUsers: number;
  isConnected?: boolean;
  status?: "online" | "offline" | "connecting";
}

export function MatchingStatus({
  onlineUsers,
  isConnected = true,
  status = "online",
}: MatchingStatusProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "text-green-400";
      case "connecting":
        return "text-yellow-400";
      case "offline":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = () => {
    if (!mounted) return null; // hydration 완료 전에는 아이콘 렌더링 안함

    if (status === "offline") {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  return (
    <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2 border border-white/20">
      <Users className={`w-4 h-4 ${getStatusColor()}`} />
      <span className="text-white text-sm">{onlineUsers}명 온라인</span>
      {!isConnected && mounted && (
        <div className={`${getStatusColor()}`}>{getStatusIcon()}</div>
      )}
    </div>
  );
}
