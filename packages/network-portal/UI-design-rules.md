# RouterOS Network Portal - UI Design Guidelines

This document outlines the design principles, color palette, and styling conventions used in the RouterOS Network Portal. Adhering to these guidelines ensures a consistent, professional, and modern user experience across the application.

---

## 1. Core Principles

- **Modern & Professional**: The UI should feel clean, sharp, and up-to-date. We use modern techniques like glassmorphism to create depth and visual interest.
- **Clarity & Consistency**: Information should be presented clearly. All elements should be styled consistently to create a predictable and intuitive user interface.
- **Responsive & Mobile-First**: The design must adapt gracefully to all screen sizes, prioritizing the user experience on mobile devices first.
- **No Emojis**: Do not use emojis anywhere in the application interface. Use proper iconography (SVG icons) instead for a professional appearance.
- **Consistent Proportions**: Maintain consistent sizing, padding, and spacing ratios across all components to create visual harmony.

---

## 2. Color Palette

Our color palette is designed for a high-contrast, visually appealing dark theme. Colors are managed via CSS custom properties in `globals.css` for easy maintenance.

| Role              | CSS Variable            | RGB Value             | Description                                      |
| ----------------- | ----------------------- | --------------------- | ------------------------------------------------ |
| **Background**    | `--background-rgb`      | `10, 10, 30`          | The primary deep navy background color.          |
| **Foreground**    | `--foreground-rgb`      | `220, 220, 255`       | The primary text and content color.              |
| **Primary**       | `--primary-rgb`         | `130, 110, 255`       | Indigo accent for interactive elements and highlights. |
| **Secondary**     | `--secondary-rgb`       | `150, 150, 170`       | Lighter gray for secondary text and icons.       |
| **Border**        | `--border-rgb`          | `40, 40, 70`          | Subtle border color for cards and elements.      |
| **Success**       | `--success-rgb`         | `50, 200, 150`        | Emerald green for success states (e.g., "Connected"). |
| **Warning**       | `--warning-rgb`         | `255, 180, 50`        | Amber for warnings or neutral actions.           |
| **Error**         | `--error-rgb`           | `255, 80, 100`        | Bright red for error states and alerts.          |

---

## 3. Typography Hierarchy

Consistent typography creates clear information hierarchy and improves readability across the application.

### Heading Styles
- **H1 (Page Titles)**: `28px`, `font-weight: 700`, `letter-spacing: -0.025em`, `margin: 0 0 8px 0`
- **H2 (Section Headers)**: `24px`, `font-weight: 600`, `letter-spacing: -0.02em`, `margin: 0 0 16px 0`
- **H3 (Subsection Headers)**: `20px`, `font-weight: 600`, `margin: 0 0 12px 0`
- **H4 (Component Headers)**: `18px`, `font-weight: 500`, `margin: 0 0 8px 0`

### Body Text
- **Primary Text**: `15px`, `font-weight: 400`, `line-height: 1.5`
- **Secondary Text**: `14px`, `font-weight: 400`, `color: rgb(var(--secondary-rgb))`
- **Small Text**: `13px`, `font-weight: 400`, used for captions and metadata
- **Technical Text**: `14px`, `font-family: monospace`, used for IPs, codes, and technical data

### Text Alignment
- **Centered Headers**: Use `text-align: center` for form headers and modal titles
- **Left-Aligned Content**: Default alignment for body text and form content
- **Right-Aligned Data**: For numerical data in tables and status displays

---

## 4. Form Design Patterns

Forms are critical user interfaces that require consistent styling and behavior patterns.

### Form Container Styling
```jsx
// Standard form container
<div style={{
  maxWidth: '400px',
  width: '100%',
  margin: '0 auto',
  padding: '32px',
  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
  border: '1px solid rgba(var(--border-rgb), 0.5)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
}}>
```

### Input Field Styling
```jsx
// Standard input field
<input style={{
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'rgba(var(--border-rgb), 0.4)',
  border: '1px solid rgba(var(--border-rgb), 0.6)',
  borderRadius: '8px',
  color: 'rgb(var(--foreground-rgb))',
  fontSize: '14px',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  outline: 'none',
  transition: 'all 0.2s ease-in-out'
}} />
```

### Form Layout Guidelines
- **Container Width**: `max-width: 400px` for optimal readability and mobile experience
- **Input Spacing**: `16px` margin between form fields
- **Padding**: `12px 16px` for input fields, `32px` for form containers
- **Border Radius**: `8px` for inputs, `12px` for containers
- **Button Spacing**: `24px` margin-top for primary action buttons

### Validation & Error States
- **Error Borders**: `border-color: rgb(var(--error-rgb))`
- **Error Text**: `12px`, `color: rgb(var(--error-rgb))`, positioned below input
- **Success States**: Use subtle green accent for successful validation

---

## 5. Authentication UI Patterns

Authentication interfaces require special consideration for security, usability, and professional appearance.

### Login Form Pattern
```jsx
// Centered authentication form
<div style={{
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.1) 0%, rgba(var(--background-rgb), 1) 100%)'
}}>
  {/* Form container with glassmorphism */}
</div>
```

### Password Input Enhancement
- **Visibility Toggle**: Eye icon to show/hide password
- **Strength Indicators**: Visual feedback for password complexity
- **Auto-complete Support**: Proper `autocomplete` attributes

### Security Messaging
- **Info Cards**: Use glassmorphism cards for security notices
- **Color Coding**: Green for secure states, amber for warnings, red for errors
- **Clear Language**: Professional, non-technical language for user guidance

---

## 6. Button Design System

Consistent button styling ensures clear user interaction patterns throughout the application.

### Primary Button
```jsx
<button style={{
  width: '100%',
  padding: '12px 24px',
  backgroundColor: 'rgb(var(--success-rgb))',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out'
}}>
```

### Button States
- **Hover**: Slight opacity reduction (`opacity: 0.9`) and subtle transform (`transform: translateY(-1px)`)
- **Active**: Deeper press effect (`transform: translateY(0)`)
- **Disabled**: Reduced opacity (`opacity: 0.5`) and `cursor: not-allowed`
- **Loading**: Spinner animation with disabled state

### Button Hierarchy
- **Primary**: Success color for main actions (login, save, create)
- **Secondary**: Border-only buttons with primary color for secondary actions
- **Danger**: Error color for destructive actions (delete, remove)
- **Ghost**: Transparent buttons for subtle actions

---

## 7. Glassmorphism & Card Styling

We use a "glassmorphism" effect for cards and primary containers to create a layered, translucent look.

### `.card` Styling
The base style for all cards is defined by the `.card` class.

```css
.card {
  background-color: rgba(var(--border-rgb), 0.3);
  border: 1px solid rgba(var(--border-rgb), 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--space-4);
  padding: var(--space-6);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
}
```

### Interactive Item Styling
List items within cards (e.g., in "Quick Actions" or "Recent Devices") use a similar, more subtle effect.

```css
/* Example: .action-item or .recent-device-item */
.action-item {
  background-color: rgba(var(--border-rgb), 0.2);
  border: 1px solid transparent;
  /* ... other styles ... */
  transition: all 0.2s ease-in-out;
}

.action-item:hover {
  background-color: rgba(var(--primary-rgb), 0.2);
  border-color: rgba(var(--primary-rgb), 0.5);
}
```
- **Base State**: A very subtle, translucent background.
- **Hover State**: The background color shifts to the primary accent color with low opacity, and a faint border appears, providing clear visual feedback.

---

## 8. Spacing & Layout System

Consistent spacing creates visual rhythm and improves the overall user experience.

### Spacing Scale
- **4px** (`--space-1`): Tight spacing for related elements
- **8px** (`--space-2`): Standard spacing between form elements
- **12px** (`--space-3`): Comfortable spacing for component padding
- **16px** (`--space-4`): Standard margin between sections
- **24px** (`--space-6`): Large spacing for major sections
- **32px** (`--space-8`): Extra large spacing for page-level separation

### Layout Patterns
- **Centered Content**: Use `margin: 0 auto` with `max-width` for centered layouts
- **Full-Height**: Use `min-height: 100vh` for full-screen layouts
- **Responsive Padding**: Use `padding: 20px` minimum with responsive increases
- **Grid Gaps**: Use consistent gaps (`16px` or `24px`) in CSS Grid layouts

---

## 9. Data Tables & Lists

For displaying large datasets with complex information, we use a sophisticated glassmorphism data table pattern that combines beauty with functionality.

### Glassmorphism Data Tables
This pattern is ideal for configuration data, network information, and any structured tabular content.

#### Structure
```jsx
{/* Search Bar */}
<div style={{ marginBottom: 'var(--space-4)' }}>
  <input 
    type="text"
    placeholder="Search table..."
    style={{
      width: '100%',
      maxWidth: '300px',
      padding: 'var(--space-2) var(--space-3)',
      backgroundColor: 'rgba(var(--border-rgb), 0.3)',
      border: '1px solid rgba(var(--border-rgb), 0.5)',
      borderRadius: 'var(--space-2)',
      color: 'rgb(var(--foreground-rgb))',
      fontSize: '0.875rem',
      backdropFilter: 'blur(12px)'
    }}
  />
</div>

{/* Data Table */}
<div className="card" style={{ padding: 0, overflow: 'hidden' }}>
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
        <th style={{ /* header styling */ }}>Column</th>
      </tr>
    </thead>
    <tbody>
      <tr style={{ /* row hover effects */ }}>
        <td style={{ /* cell styling */ }}>Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

#### Design Features
- **Glassmorphism Container**: Table wrapped in `.card` class with `padding: 0` and `overflow: 'hidden'`
- **Header Styling**: Darker background (`rgba(var(--border-rgb), 0.4)`) with clear visual hierarchy
- **Interactive Rows**: Subtle hover effects with primary color highlight (`rgba(var(--primary-rgb), 0.1)`)
- **Consistent Spacing**: `var(--space-3) var(--space-4)` padding for cells
- **Typography**: Monospace font for technical data (IPs, IDs), regular font for descriptive text
- **Action Buttons**: Compact, color-coded buttons with hover states
- **Search Integration**: Glassmorphism search input with backdrop blur

#### Color Coding
- **Status Indicators**: Green for active/connected, amber for warning states, red for errors
- **Technical Data**: Monospace font in primary foreground color
- **Secondary Information**: Lighter secondary color for less critical data
- **Interactive Elements**: Primary color for actions, error color for destructive actions

This pattern provides excellent scalability for large datasets while maintaining visual appeal and usability.

---

## 10. Custom Select Component

Our application uses a sophisticated custom select component (`CustomSelect`) that provides enhanced functionality beyond standard HTML select elements.

### Features
- **Glassmorphism Design**: Consistent with our overall design language, featuring backdrop blur and translucent backgrounds
- **Keyboard Navigation**: Full arrow key navigation, Enter/Space selection, and Escape to close
- **Searchable Options**: Optional search functionality to filter through large option sets
- **Custom Value Support**: Ability to allow users to enter custom values not in the predefined list
- **Modal-Safe Rendering**: Portal option to render dropdowns above modal overlays
- **Loading States**: Built-in support for loading states during async operations
- **Disabled States**: Proper handling of disabled options and component states

### Usage Patterns

#### Basic Select
```jsx
<CustomSelect
  options={[
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' }
  ]}
  value={selectedValue}
  onChange={handleChange}
  placeholder="Select an option..."
/>
```

#### Searchable Select with Custom Values
```jsx
<CustomSelect
  options={protocolOptions}
  value={protocol}
  onChange={setProtocol}
  placeholder="Select or type protocol..."
  searchable={true}
  allowCustom={true}
  portal={true} // For use in modals
/>
```

#### Interface Selection with Loading State
```jsx
<CustomSelect
  options={interfaces}
  value={selectedInterface}
  onChange={setSelectedInterface}
  placeholder={loading ? 'Loading interfaces...' : 'Select interface...'}
  disabled={loading}
  portal={true}
/>
```

### Design Specifications
- **Background**: `rgba(var(--border-rgb), 0.4)` with `backdrop-filter: blur(8px)`
- **Border**: `1px solid rgba(var(--border-rgb), 0.6)` with hover state `rgba(var(--primary-rgb), 0.4)`
- **Focus State**: Primary color border with subtle box-shadow
- **Dropdown**: Higher backdrop blur (`blur(16px)`) with elevated shadow
- **Options**: Hover effects with primary color highlights and smooth transitions
- **Search Input**: Integrated search with consistent styling and backdrop blur

### When to Use
- **Interface Selection**: When users need to select from available network interfaces
- **Protocol Selection**: For firewall rules, routing, and other network configurations  
- **Predefined Lists**: Any scenario with a known set of options that may need searching
- **Modal Forms**: Use `portal={true}` to ensure dropdowns appear above modal overlays
- **Dynamic Options**: When option lists are loaded asynchronously from APIs

The CustomSelect component ensures consistent user experience across all form interactions while providing the flexibility needed for complex network configuration scenarios.

---

## 11. Custom Dialog Components

Our application uses custom dialog components that follow the glassmorphism design language for consistent user experience.

### ConfirmDialog Component

A sophisticated confirmation dialog that replaces native browser `confirm()` dialogs with a beautiful, accessible alternative.

#### Features
- **Glassmorphism Design**: Consistent backdrop blur and translucent backgrounds
- **Type-Based Styling**: Different visual treatments for `danger`, `warning`, and `info` types
- **Icon Integration**: Contextual icons that match the dialog type
- **Keyboard Accessible**: Proper focus management and keyboard navigation
- **Click-Outside Dismissal**: Users can click the backdrop to cancel
- **Customizable Text**: Configurable button labels and messages

#### Usage Patterns

```jsx
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

// Danger confirmation (red theme)
<ConfirmDialog
  isOpen={showDeleteDialog}
  title="Delete Backup"
  message={`Are you sure you want to delete the backup "${backupName}"? This action cannot be undone.`}
  confirmText="Delete"
  cancelText="Cancel"
  type="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteDialog(false)}
/>

// Warning confirmation (amber theme)
<ConfirmDialog
  isOpen={showWarningDialog}
  title="Unsaved Changes"
  message="You have unsaved changes. Are you sure you want to leave?"
  confirmText="Leave"
  cancelText="Stay"
  type="warning"
  onConfirm={handleLeave}
  onCancel={() => setShowWarningDialog(false)}
/>
```

#### Design Specifications
- **Backdrop**: `rgba(0, 0, 0, 0.5)` with `backdrop-filter: blur(4px)`
- **Dialog**: `rgba(var(--background-rgb), 0.95)` with `backdrop-filter: blur(20px)`
- **Shadow**: `0 20px 40px 0 rgba(0, 0, 0, 0.4)` for elevated appearance
- **Border**: `1px solid rgba(var(--border-rgb), 0.8)` for definition
- **Responsive**: Adapts to mobile with proper padding and sizing

### Tooltip Component

A smart tooltip component that provides contextual information with automatic positioning and glassmorphism styling.

#### Features
- **Smart Positioning**: Automatically adjusts position to stay within viewport
- **Multiple Positions**: Support for `top`, `bottom`, `left`, `right` positioning
- **Delay Control**: Configurable show delay to prevent accidental triggers
- **Scroll Dismissal**: Automatically hides on scroll or resize events
- **Glassmorphism Design**: Consistent with overall design language
- **Arrow Indicators**: Visual arrows pointing to trigger elements

#### Usage Patterns

```jsx
import { Tooltip } from '../components/ui/Tooltip';

// Basic tooltip
<Tooltip content="Download this backup to your computer">
  <button className="btn btn-primary">Download</button>
</Tooltip>

// Positioned tooltip with custom delay
<Tooltip 
  content="This backup is stored only on the RouterOS device"
  position="bottom"
  delay={300}
>
  <span className="status-badge">Device</span>
</Tooltip>

// Conditional tooltip
<Tooltip 
  content={isLocal ? "Stored locally" : "Available on device only"}
  disabled={!showTooltips}
>
  <div className="backup-status">{status}</div>
</Tooltip>
```

#### Design Specifications
- **Background**: `rgba(var(--background-rgb), 0.95)` with `backdrop-filter: blur(16px)`
- **Border**: `1px solid rgba(var(--border-rgb), 0.6)` for subtle definition
- **Shadow**: `0 8px 32px 0 rgba(0, 0, 0, 0.3)` for depth
- **Typography**: `0.8rem` font size with `var(--text-primary)` color
- **Max Width**: `250px` with word wrapping for long content
- **Arrow**: 6px triangular arrow matching background color

#### When to Use
- **Action Clarification**: Explain what buttons or actions do
- **Status Information**: Provide context for status indicators or badges
- **Technical Details**: Show additional information without cluttering the UI
- **Progressive Disclosure**: Reveal secondary information on hover/focus

Both components integrate seamlessly with our existing design system and provide consistent, accessible user interactions across the application.

---

## 12. Iconography

- **Style**: We use stroke-based, outline-style SVG icons.
- **Consistency**: All icons should share a similar visual weight. Where possible, use a consistent `stroke-width` (e.g., `2`) for a cohesive look.
- **Implementation**: Icons are implemented as inline SVGs within React components for direct styling and control.
- **Color**: Icons inherit text color by default, use `currentColor` for `stroke` or `fill` attributes.
- **Size**: Standard icon sizes are `16px`, `20px`, and `24px` for different contexts.

---

## 13. Implementation Guidelines

### Code Organization
- **Inline Styles**: Use inline styles for component-specific styling that needs dynamic values
- **CSS Custom Properties**: Use CSS variables for consistent theming and easy maintenance
- **Consistent Naming**: Use descriptive, consistent naming for CSS classes and variables
- **Responsive Design**: Always consider mobile-first responsive design principles

### Performance Considerations
- **Backdrop Filter**: Use `backdrop-filter` and `-webkit-backdrop-filter` for broad browser support
- **Transitions**: Keep transitions smooth but performant (`0.2s ease-in-out` is standard)
- **Image Optimization**: Use SVG for icons and optimize images for different screen densities

### Accessibility
- **Focus States**: Ensure all interactive elements have clear focus indicators
- **Color Contrast**: Maintain WCAG AA contrast ratios for all text and interactive elements
- **Keyboard Navigation**: Support full keyboard navigation for all interactive components
- **Screen Readers**: Use proper ARIA labels and semantic HTML structure

### Testing
- **Cross-Browser**: Test glassmorphism effects across different browsers
- **Mobile Testing**: Verify responsive behavior on various device sizes
- **Dark Mode**: Ensure consistent appearance in dark theme environments
- **Performance**: Monitor performance impact of backdrop filters and animations 