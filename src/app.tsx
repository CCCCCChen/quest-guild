import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import TodayPage from "@/pages/Today/TodayPage";
import GoalsPage from "@/pages/Goals/GoalsPage";
import ProjectsPage from "@/pages/Projects/ProjectsPage";
import ProjectDetailPage from "@/pages/Projects/ProjectDetailPage";
import ReflectionsPage from "@/pages/Reflections/ReflectionsPage";
import QuestPoolPage from "@/pages/QuestPool/QuestPoolPage";
import SkillTreePage from "@/pages/SkillTree/SkillTreePage";
import ShopPage from "@/pages/Shop/ShopPage";
import StatsPage from "@/pages/Stats/StatsPage";
import SettingsPage from "@/pages/Settings/SettingsPage";
import FloatingWidget from "@/components/FloatingWidget";
import CompletionFeedbackModal from "@/components/CompletionFeedbackModal";
import { useEffect } from "react";
import { useReminderWatcher } from "@/hooks/useReminderWatcher";

export default function App() {
  const isFloatingMode = new URLSearchParams(window.location.search).get('mode') === 'floating';

  // P2-C2：本地提醒引擎（主窗口挂载，渲染进程轮询 + Notification API）
  useReminderWatcher();

  useEffect(() => {
    if (isFloatingMode) {
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.background = '';
      document.documentElement.style.background = '';
      document.body.style.overflow = '';
    };
  }, [isFloatingMode]);

  if (isFloatingMode) {
    return (
      <div className="w-full h-screen overflow-hidden bg-transparent">
        <FloatingWidget isWindowMode />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="reflections" element={<ReflectionsPage />} />
          <Route path="quest-pool" element={<QuestPoolPage />} />
          <Route path="skill-tree" element={<SkillTreePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <CompletionFeedbackModal />
    </>
  );
}
