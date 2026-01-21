# Frontend Migration Plan: Shadcn/Radix UI to Ant Design v5

## 1. Overview
The goal is to replace the current frontend UI library (Shadcn UI based on Radix UI & Tailwind CSS) with **Ant Design (antd) v5.x**. This refactoring aims to leverage Ant Design's enterprise-grade component suite, unified design language, and rich interactive features.

## 2. Dependency Management

### Add Dependencies
- `antd`: The core UI library.
- `@ant-design/icons`: For standard UI icons (optional, can mix with `lucide-react`).
- `@ant-design/cssinjs`: For better performance and cache handling (if needed).

### Remove Dependencies (Post-Migration)
- `@radix-ui/*`: All primitives.
- `class-variance-authority`, `clsx`, `tailwind-merge`: Utility libraries heavily used by Shadcn.
- `sonner`: Replaced by Antd `message` / `notification`.
- `vaul`, `cmdk`: Specific UI interactions replaced by Antd equivalents.

### Tailwind CSS Status
- **Keep Tailwind CSS**: It is still useful for layout utilities (margins, padding, flexbox, grid, typography) which Antd does not strictly enforce.
- **Compatibility**: We need to ensure Tailwind's Preflight (base styles) does not conflict with Antd. Antd v5 uses CSS-in-JS and usually plays well, but we might need to disable Tailwind's preflight for certain elements if conflicts arise.

## 3. Theme & Global Configuration

### ConfigProvider
Wrap the entire application (in `App.tsx` or `main.tsx`) with `<ConfigProvider>`.

```tsx
import { ConfigProvider, theme } from 'antd';

// Inside your component
<ConfigProvider
  theme={{
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff', // Or match current brand color
    },
  }}
>
  <App />
</ConfigProvider>
```

### Dark Mode
- Current: Tailwind `dark:` class strategy.
- New: Antd `theme.darkAlgorithm`.
- **Sync**: We need to ensure the `ThemeContext` updates both the Tailwind `dark` class (on `html` tag) AND the Antd `ConfigProvider` algorithm.

## 4. Component Migration Strategy

### 4.1. Layout & Navigation
- **Current**: Custom Flexbox sidebar with `Link` components.
- **New**: `antd/Layout` (Sider, Content) + `antd/Menu`.
- **Benefit**: Native support for collapsible sidebar, nested menus.

### 4.2. Tables (Biggest Change)
- **Current**: `<Table><TableHeader><TableRow>...` (Declarative, HTML-like).
- **New**: `<Table columns={columns} dataSource={data} />` (Data-driven).
- **Action**:
  - Define `columns` definitions for `KnowledgeBase` and other lists.
  - Implement `pagination` prop mapping (current manual pagination -> Antd pagination config).
  - Custom cell rendering (Actions, Status badges) using `render` function in columns.

### 4.3. Modals / Dialogs
- **Current**: `<Dialog><DialogTrigger>...` (Radix primitives).
- **New**: `<Modal open={isOpen} onCancel={close} onOk={submit} ...>`.
- **Note**: Antd Modals separate "footer" actions by default. We can customize `footer` or use the default OK/Cancel buttons.
- **Preview Dialog**: For the file preview feature, use `<Modal width="95vw" style={{ top: 20 }} ...>` to replicate the large previewer.

### 4.4. Forms
- **Current**: Uncontrolled or Manual State (`useState`) + HTML inputs.
- **New**: `antd/Form` + `Form.Item` + `Input`/`Select`.
- **Benefit**: Built-in validation, layout management, loading states.
- **Action**: Refactor `Login` and `RAG Config` forms to use `Form.useForm()`.

### 4.5. Feedback
- **Current**: `sonner` (`toast.success`).
- **New**: `antd/App` wrapper -> `message.success` / `notification.info`.

## 5. Execution Plan

### Phase 1: Setup & Infrastructure
1. Install `antd`.
2. Configure `ConfigProvider` in `App.tsx`.
3. Update `ThemeContext` to drive Antd theme.
4. Verify Button rendering and Dark Mode switch.

### Phase 2: Core Layout
1. Rewrite `Layout.tsx` using `antd/Layout` and `Menu`.
2. Replace Logout Dialog with `Modal.confirm`.

### Phase 3: Login Page
1. Refactor `Login.tsx` to use `antd/Form`, `Input`, `Card`, `Button`.
2. Verify authentication flow.

### Phase 4: Knowledge Base (Complex)
1. Replace `Table` with `antd/Table`.
   - Map backend data to `dataSource`.
   - Configure Pagination.
2. Re-implement "Upload Document" using `antd/Upload` (or `Dragger`) inside a `Modal`.
3. Re-implement "RAG Config" dialog using `antd/Form` inside a `Modal`.
4. Re-implement "File Preview" using `antd/Modal` (Custom content for PDF/Image/Text).
   - **Crucial**: Ensure the "large preview" experience requested by user is maintained.
5. Re-implement "Delete" using `Popconfirm` or `Modal.confirm`.

### Phase 5: Chat Interface
1. Replace Session List with `antd/List` or `Menu`.
2. Replace Message Input with `Input.TextArea`.
3. Replace Dropdowns (Rename/Delete) with `antd/Dropdown`.
4. Adapt Markdown styling if necessary (Antd typography vs Tailwind prose).

## 6. Testing Plan

### 6.1. Functional Testing
- **Login**:
  - [ ] Empty submission triggers validation error.
  - [ ] Invalid credentials show error message.
  - [ ] Success redirects to Home.
- **Navigation**:
  - [ ] Sidebar links work.
  - [ ] Dark/Light mode toggle affects both Tailwind backgrounds and Antd components.
- **Knowledge Base**:
  - [ ] List loads with pagination.
  - [ ] Upload file (success/fail scenarios).
  - [ ] Preview works for supported file types (PDF, Image, Text).
  - [ ] Preview Modal is large and dismissible.
  - [ ] Config update works.
  - [ ] Delete works.
- **Chat**:
  - [ ] Send message.
  - [ ] Streaming response renders correctly.
  - [ ] Session management (Create/Rename/Delete).

### 6.2. Visual Verification
- Ensure no "transparent" backgrounds where "white/dark" is expected.
- Ensure z-index of Modals/Dropdowns is correct (Antd uses 1000+).
- Ensure fonts are consistent.

## 7. Next Steps
Waiting for user approval to proceed with **Phase 1 (Setup)**.
