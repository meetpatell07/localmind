"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    data-slot="tabs"
    className={cn("flex flex-col gap-4", className)}
    {...props}
  />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState<HTMLButtonElement | null>(
    null,
  );
  const [indicatorStyle, setIndicatorStyle] = React.useState({
    left: 0,
    width: 0,
  });

  React.useEffect(() => {
    if (!listRef.current) return;

    const updateActiveTab = () => {
      const activeTabElement = listRef.current?.querySelector(
        '[data-state="active"]',
      ) as HTMLButtonElement;
      if (activeTabElement && activeTabElement !== activeTab) {
        setActiveTab(activeTabElement);
      }
    };

    updateActiveTab();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-state"
        ) {
          updateActiveTab();
        }
      });
    });

    const tabTriggers = listRef.current.querySelectorAll(
      '[data-slot="tabs-trigger"]',
    );
    tabTriggers.forEach((trigger) => {
      observer.observe(trigger, { attributes: true });
    });

    return () => {
      observer.disconnect();
    };
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();

      setIndicatorStyle({
        left: tabRect.left - listRect.left,
        width: tabRect.width,
      });
    }
  }, [activeTab]);

  return (
    <div className="relative" ref={listRef}>
      <TabsPrimitive.List
        ref={ref}
        data-slot="tabs-list"
        className={cn(
          "inline-flex w-full border-b mb-0! border-border cursor-pointer items-center p-0.5 text-foreground h-auto gap-2 bg-transparent px-0 py-1",
          className,
        )}
        {...props}
      />
      <motion.div
        className="absolute bottom-0 h-0.5 bg-brand rounded-t-full"
        initial={false}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={{
          type: "tween",
          duration: 0.1,
          ease: "easeOut",
        }}
      />
    </div>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    className={cn(
      "data-[state=active]:text-foreground text-muted-foreground text-xs cursor-pointer font-medium inline-flex items-center justify-center px-3 py-1.5 whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 hover:text-foreground relative data-[state=active]:bg-transparent data-[state=active]:shadow-none",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn("flex-1 outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
