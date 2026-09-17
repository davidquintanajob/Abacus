'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { IconStrip } from './IconStrip';
import { Sidebar } from './Sidebar';
import { useResponsive } from '../../hooks/useResponsive';
import { useModal } from '../../context/ModalContext';

interface SidebarNavigationProps {
  currentRoute?: string;
  onMenuPress?: () => void;
}

export interface SidebarNavigationRef {
  openSidebar: () => void;
}

export const SidebarNavigation = forwardRef<SidebarNavigationRef, SidebarNavigationProps>(({ currentRoute = 'Home', onMenuPress }, ref) => {
  const { isDesktop } = useResponsive();
  const { isModalOpen } = useModal();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [iconStripHovered, setIconStripHovered] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [closeTimeout, setCloseTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleIconStripHover = () => {
    if (!isDesktop) return; // Only enable hover on desktop
    if (isModalOpen) return; // Don't open sidebar if modal is open
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    setIconStripHovered(true);
  };

  const handleIconStripLeave = () => {
    if (!isDesktop) return; // Only enable hover on desktop
    if (isModalOpen) return; // Don't close sidebar if modal is open
    if (!sidebarHovered) {
      const timeout = setTimeout(() => {
        setIconStripHovered(false);
      }, 150);
      setCloseTimeout(timeout);
    }
  };

  const handleSidebarEnter = () => {
    if (!isDesktop) return; // Only enable hover on desktop
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      setCloseTimeout(null);
    }
    setSidebarHovered(true);
  };

  const handleSidebarLeave = () => {
    if (!isDesktop) return; // Only enable hover on desktop
    if (isModalOpen) return; // Don't close sidebar if modal is open
    setSidebarHovered(false);
    const timeout = setTimeout(() => {
      setIconStripHovered(false);
    }, 150);
    setCloseTimeout(timeout);
  };

  const handleMenuPress = () => {
    setSidebarOpen(true);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  // Expose openSidebar function to parent components
  useImperativeHandle(ref, () => ({
    openSidebar: handleMenuPress,
  }));

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
      }
    };
  }, [closeTimeout]);

  return (
    <>
      <IconStrip 
        onHover={handleIconStripHover}
        onLeave={handleIconStripLeave}
        currentRoute={currentRoute}
      />
      
      <Sidebar 
        isOpen={sidebarOpen || iconStripHovered || sidebarHovered} 
        onClose={handleSidebarClose}
        hoverTriggered={isDesktop && (iconStripHovered || sidebarHovered)}
        onSidebarEnter={handleSidebarEnter}
        onSidebarLeave={handleSidebarLeave}
        currentRoute={currentRoute}
      />
    </>
  );
});

SidebarNavigation.displayName = 'SidebarNavigation';
