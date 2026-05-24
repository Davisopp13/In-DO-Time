/** Centralized z-index hierarchy to prevent overlap issues */
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  sidebar: 25,
  header: 30,
  fab: 35,
  overlay: 40,
  drawer: 45,
  modal: 50,
  dropdown_portal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
} as const;
