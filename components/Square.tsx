import React, { useState, useEffect } from "react";
import {
  Hash,
  Search,
  Users,
  Bell,
  ArrowUp,
  Menu,
} from "lucide-react";
import { Button, cn } from "./UI";
import { useElasticScroll } from "../hooks/useElasticScroll";
import { useSquareExperience } from "../hooks/useSquareExperience";
import { SquareChannelSidebar } from "./square/SquareChannelSidebar";
import { SquareComposer } from "./square/SquareComposer";
import { SquareConfirmDialog } from "./square/SquareConfirmDialog";
import { SquareNotificationsMenu } from "./square/SquareNotificationsMenu";
import { SquarePostDetailModal } from "./square/SquarePostDetailModal";
import { SquarePostList } from "./square/SquarePostList";
import { SquareProfileModal } from "./square/SquareProfileModal";
import { requestFriendship } from "../services/friendsModel";
import * as friendsRepository from "../services/friendsRepository";
import type { Profile } from "../types";

export const Square: React.FC = () => {
  const {
    feed,
    composer,
    comments,
    notifications,
    mobileSidebar,
    profilePanel,
    deletion,
  } = useSquareExperience();
  const {
    activeChannelId,
    activeChannel,
    categories,
    channels,
    posts,
    loadingChannels,
    loadingPosts,
    currentUser,
    selectChannel,
    handleLikePost,
  } = feed;
  const {
    searchQuery,
    setSearchQuery,
    newPostContent,
    setNewPostContent,
    posting,
    pendingImage,
    pendingModules,
    shareableCharacters,
    addCharacterModule,
    removeModule,
    clearPendingImage,
    processFile,
    handlePaste,
    handleDrop,
    handlePost,
  } = composer;
  const {
    selectedPost,
    selectedPostComments,
    selectedPostLoading,
    openPost,
    closePost,
    handleSendComment,
    handleLikeComment,
  } = comments;
  const {
    showNotifications,
    toggleNotifications,
    closeNotifications,
    notifications: squareNotifications,
    unreadCount,
    markAsRead,
    handleDeleteNotification,
  } = notifications;
  const {
    showMobileSidebar,
    openMobileSidebar,
    closeMobileSidebar,
  } = mobileSidebar;

  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(scrollContainerRef, contentRef);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowBackToTop(scrollTop > 300);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleRequestFriend = React.useCallback(
    async (profile: Profile) => {
      if (!currentUser?.id) return;

      const result = await requestFriendship({
        currentUserId: currentUser.id,
        targetUserId: profile.id,
        repository: friendsRepository,
        storage: localStorage,
      });
      alert(result.message);
    },
    [currentUser?.id]
  );

  return (
    <div className="flex h-full dicecho-page-bg text-slate-200 overflow-hidden relative">
      <SquareChannelSidebar
        activeChannelId={activeChannelId}
        categories={categories}
        channels={channels}
        loadingChannels={loadingChannels}
        showMobileSidebar={showMobileSidebar}
        onClose={closeMobileSidebar}
        onSelectChannel={selectChannel}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-dicecho-border/40 flex items-center justify-between px-4 md:px-6 bg-dicecho-panel/85 relative">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-dicecho-muted hover:text-white mr-1"
              onClick={openMobileSidebar}
            >
              <Menu size={24} />
            </button>
            <Hash className="text-dicecho-primary hidden md:block" size={24} />
            <div>
              <h3 className="font-bold text-white text-lg">
                {activeChannel?.name || "加载中..."}
              </h3>
              <p className="text-xs text-dicecho-muted">
                {activeChannel?.description || "暂无描述"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64 hidden md:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-dicecho-muted"
                size={16}
              />
              <input
                type="text"
                placeholder="搜索话题..."
                className="w-full rounded-lg border border-dicecho-border/50 bg-dicecho-panel/70 pl-9 pr-4 py-1.5 text-sm text-white placeholder:text-dicecho-muted/60 focus:outline-none focus:border-dicecho-primary/70 transition-colors duration-150"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="static md:relative">
              <Button
                variant="ghost"
                size="icon"
                icon={Bell}
                className={unreadCount > 0 ? "text-dicecho-primary" : ""}
                onClick={toggleNotifications}
              />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-dicecho-panel animate-pulse"></span>
              )}
              <SquareNotificationsMenu
                show={showNotifications}
                notifications={squareNotifications}
                unreadCount={unreadCount}
                onClose={closeNotifications}
                onMarkAsRead={markAsRead}
                onDeleteNotification={handleDeleteNotification}
              />
            </div>
            <Button variant="ghost" size="icon" icon={Users} />
          </div>
        </header>

        {/* Post List */}
        <div
          className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar overscroll-y-none"
          ref={scrollContainerRef}
        >
          <div
            ref={contentRef}
            className="max-w-4xl mx-auto space-y-6 min-h-full"
          >
            <SquareComposer
              activeChannelName={activeChannel?.name}
              shareableCharacters={shareableCharacters}
              pendingModules={pendingModules}
              addCharacterModule={addCharacterModule}
              removeModule={removeModule}
              newPostContent={newPostContent}
              setNewPostContent={setNewPostContent}
              posting={posting}
              pendingImage={pendingImage}
              clearPendingImage={clearPendingImage}
              processFile={processFile}
              handlePaste={handlePaste}
              handleDrop={handleDrop}
              handlePost={handlePost}
            />
            <SquarePostList
              posts={posts}
              loadingPosts={loadingPosts}
              searchQuery={searchQuery}
              currentUserId={currentUser?.id}
              openProfile={profilePanel.openProfile}
              openPost={openPost}
              onLikePost={handleLikePost}
              onRequestDeletePost={deletion.requestDeletePost}
            />
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8 z-50 p-3 bg-dicecho-primary-strong text-white rounded-full shadow-lg shadow-black/20 transition-opacity duration-150 hover:bg-dicecho-primary",
          showBackToTop
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        )}
      >
        <ArrowUp size={24} />
      </button>

      <SquareProfileModal
        isOpen={profilePanel.isOpen}
        profile={profilePanel.selectedProfile}
        currentUserId={currentUser?.id}
        historyTab={profilePanel.historyTab}
        setHistoryTab={profilePanel.setHistoryTab}
        historyLoading={profilePanel.historyLoading}
        kpHistory={profilePanel.kpHistory}
        playerHistory={profilePanel.playerHistory}
        onRequestFriend={handleRequestFriend}
        onClose={profilePanel.closeProfile}
      />
      {/* Post Detail Modal */}
      {selectedPost && (
        <SquarePostDetailModal
          post={selectedPost}
          currentUser={currentUser}
          onClose={closePost}
          onDeleteComment={deletion.requestDeleteComment}
          comments={selectedPostComments}
          loadingComments={selectedPostLoading}
          openProfile={profilePanel.openProfile}
          onSendComment={handleSendComment}
          onLikeComment={handleLikeComment}
        />
      )}
      {/* Confirm Delete */}
      <SquareConfirmDialog
        open={deletion.dialog.open}
        title={deletion.dialog.title}
        content={deletion.dialog.content}
        onCancel={deletion.dialog.onCancel}
        onConfirm={deletion.dialog.onConfirm}
      />
    </div>
  );
};

