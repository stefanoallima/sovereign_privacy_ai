import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VaultBrowser } from "../VaultBrowser";
import { usePiiVaultStore } from "@/stores/piiVault";
import type { PiiVaultEntry } from "@/types";

describe("VaultBrowser", () => {
  beforeEach(() => {
    // Clear store before each test
    usePiiVaultStore.setState({ entries: [] });
    vi.clearAllMocks();
  });

  describe("render", () => {
    it("should render component with header and empty state", () => {
      render(<VaultBrowser />);

      expect(screen.getByText("PII Vault")).toBeInTheDocument();
      expect(screen.getByText(/No entries yet/)).toBeInTheDocument();
    });

    it("should display entry count badge when entries exist", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("Jane Smith", "person name");

      render(<VaultBrowser />);

      expect(screen.getByText("2 entries")).toBeInTheDocument();
    });

    it("should display singular 'entry' for single entry", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      expect(screen.getByText("1 entry")).toBeInTheDocument();
    });

    it("should render search input", () => {
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("entries list", () => {
    it("should render all entries when empty", () => {
      render(<VaultBrowser />);

      const emptyMessage = screen.getByText(
        /No entries yet. PII detected in messages will appear here/
      );
      expect(emptyMessage).toBeInTheDocument();
    });

    it("should render entries with their data", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("person name")).toBeInTheDocument();
      expect(screen.getByText(entry.placeholder)).toBeInTheDocument();
    });

    it("should display use count for entries", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");
      store.incrementUseCount(entry.id);
      store.incrementUseCount(entry.id);

      render(<VaultBrowser />);

      expect(screen.getByText("Used 2 times")).toBeInTheDocument();
    });

    it("should display singular 'time' for use count of 1", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("Test Name", "person name");
      store.incrementUseCount(entry.id);

      render(<VaultBrowser />);

      expect(screen.getByText("Used 1 time")).toBeInTheDocument();
    });

    it("should render multiple entries", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("jane@example.com", "email");
      store.addEntry("555-1234", "phone");

      render(<VaultBrowser />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      expect(screen.getByText("555-1234")).toBeInTheDocument();
    });
  });

  describe("search/filter", () => {
    beforeEach(() => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("jane@example.com", "email");
      store.addEntry("555-1234", "phone");
    });

    it("should filter entries by text", async () => {
      const user = userEvent.setup();
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      await user.type(searchInput, "John");

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.queryByText("jane@example.com")).not.toBeInTheDocument();
      expect(screen.queryByText("555-1234")).not.toBeInTheDocument();
    });

    it("should filter entries by category", async () => {
      const user = userEvent.setup();
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      await user.type(searchInput, "email");

      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.queryByText("555-1234")).not.toBeInTheDocument();
    });

    it("should filter entries case-insensitively", async () => {
      const user = userEvent.setup();
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      await user.type(searchInput, "PHONE");

      expect(screen.getByText("555-1234")).toBeInTheDocument();
    });

    it("should show no results message when search matches nothing", async () => {
      const user = userEvent.setup();
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      await user.type(searchInput, "nonexistent");

      expect(screen.getByText(/No entries match/)).toBeInTheDocument();
    });

    it("should clear search results when search term is emptied", async () => {
      const user = userEvent.setup();
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      ) as HTMLInputElement;
      await user.type(searchInput, "John");

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.queryByText("jane@example.com")).not.toBeInTheDocument();

      // Clear search
      await user.clear(searchInput);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      expect(screen.getByText("555-1234")).toBeInTheDocument();
    });
  });

  describe("delete button", () => {
    it("should delete entry when delete button is clicked", async () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");

      const { rerender } = render(<VaultBrowser />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();

      // Find and click delete button
      const deleteButton = screen.getByTitle("Delete entry");
      fireEvent.click(deleteButton);

      // Re-render to see the updated state
      rerender(<VaultBrowser />);

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(store.entries.length).toBe(0);
    });

    it("should remove only the selected entry", async () => {
      const store = usePiiVaultStore.getState();
      const entry1 = store.addEntry("John Doe", "person name");
      const entry2 = store.addEntry("Jane Smith", "person name");

      const { rerender } = render(<VaultBrowser />);

      const deleteButtons = screen.getAllByTitle("Delete entry");
      fireEvent.click(deleteButtons[0]); // Delete first entry

      rerender(<VaultBrowser />);

      expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(store.entries.length).toBe(1);
    });
  });

  describe("edit callback", () => {
    it("should call onOpenEntry callback when edit button is clicked", () => {
      const store = usePiiVaultStore.getState();
      const entry = store.addEntry("John Doe", "person name");
      const onOpenEntry = vi.fn();

      render(<VaultBrowser onOpenEntry={onOpenEntry} />);

      const editButton = screen.getByTitle("Edit entry");
      fireEvent.click(editButton);

      expect(onOpenEntry).toHaveBeenCalledWith(expect.objectContaining({
        id: entry.id,
        text: "John Doe",
        category: "person name",
      }));
    });

    it("should not call onOpenEntry if callback is not provided", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      // Should not throw error
      render(<VaultBrowser />);

      const editButton = screen.getByTitle("Edit entry");
      fireEvent.click(editButton);
    });
  });

  describe("export button", () => {
    it("should export entries as JSON file", async () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("jane@example.com", "email");

      // Mock URL.createObjectURL and createElement
      const mockClick = vi.fn();
      const mockUrl = "blob:mock-url";
      vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

      const mockLink = {
        click: mockClick,
        href: "",
        download: "",
      };
      vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);

      render(<VaultBrowser />);

      const exportButton = screen.getByText("Export Vault");
      fireEvent.click(exportButton);

      expect(mockClick).toHaveBeenCalled();
      expect(mockLink.download).toMatch(/^vault-export-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("should not show export button when no entries exist", () => {
      render(<VaultBrowser />);

      const exportButton = screen.queryByText("Export Vault");
      expect(exportButton).not.toBeInTheDocument();
    });

    it("should show export button when entries exist", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const exportButton = screen.getByText("Export Vault");
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe("clear all button", () => {
    it("should show clear all button when entries exist", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      expect(clearButton).toBeInTheDocument();
    });

    it("should not show clear all button when no entries exist", () => {
      render(<VaultBrowser />);

      const clearButton = screen.queryByText("Clear All");
      expect(clearButton).not.toBeInTheDocument();
    });

    it("should show confirmation dialog when clear all is clicked", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);

      expect(screen.getByText("Clear PII Vault?")).toBeInTheDocument();
      expect(screen.getByText(/This will permanently delete all 1 vault entries/)).toBeInTheDocument();
    });

    it("should clear all entries when confirmation is accepted", async () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");
      store.addEntry("Jane Smith", "person name");

      const { rerender } = render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);

      const confirmButton = screen.getByRole("button", { name: "Clear All" });
      fireEvent.click(confirmButton);

      rerender(<VaultBrowser />);

      expect(store.entries.length).toBe(0);
      expect(screen.getByText(/No entries yet/)).toBeInTheDocument();
      expect(screen.queryByText("Clear PII Vault?")).not.toBeInTheDocument();
    });

    it("should close confirmation dialog when cancel is clicked", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);

      expect(screen.getByText("Clear PII Vault?")).toBeInTheDocument();

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(screen.queryByText("Clear PII Vault?")).not.toBeInTheDocument();
    });

    it("should close confirmation dialog when X button is clicked", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);

      expect(screen.getByText("Clear PII Vault?")).toBeInTheDocument();

      const closeButtons = screen.getAllByRole("button").filter(btn =>
        btn.className.includes("hover:bg-[hsl(var(--accent))]")
      );
      const confirmHeaderCloseBtn = closeButtons[0];
      fireEvent.click(confirmHeaderCloseBtn);

      expect(screen.queryByText("Clear PII Vault?")).not.toBeInTheDocument();
    });

    it("should not modify entries when confirmation is cancelled", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      const { rerender } = render(<VaultBrowser />);

      const clearButton = screen.getByText("Clear All");
      fireEvent.click(clearButton);

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      rerender(<VaultBrowser />);

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(store.entries.length).toBe(1);
    });
  });

  describe("responsive behavior", () => {
    it("should display action buttons in a row when entries exist", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      const exportButton = screen.getByText("Export Vault");
      const clearButton = screen.getByText("Clear All");

      expect(exportButton.parentElement?.className).toContain("flex");
      expect(clearButton.parentElement?.className).toContain("flex");
    });
  });

  describe("accessibility", () => {
    it("should have proper button titles for icon buttons", () => {
      const store = usePiiVaultStore.getState();
      store.addEntry("John Doe", "person name");

      render(<VaultBrowser />);

      expect(screen.getByTitle("Edit entry")).toBeInTheDocument();
      expect(screen.getByTitle("Delete entry")).toBeInTheDocument();
    });

    it("should have descriptive labels", () => {
      render(<VaultBrowser />);

      const searchInput = screen.getByPlaceholderText(
        /Search by name, type, or placeholder/
      );
      expect(searchInput).toHaveAttribute("type", "text");
    });
  });
});
