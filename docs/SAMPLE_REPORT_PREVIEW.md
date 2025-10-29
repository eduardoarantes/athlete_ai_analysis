# Sample Report Preview

## Visual Design

The structured markdown approach generates a modern, professional HTML report with the following visual features:

### Color Scheme
- **Background**: Purple-to-blue gradient (`#667eea` → `#764ba2`)
- **Header**: Deep blue gradient (`#1e3c72` → `#2a5298`)
- **Content**: White container with subtle shadow
- **Accents**: Blue (`#1e3c72`, `#667eea`) for headers and highlights
- **Success/Growth**: Green (`#27ae60`) for positive changes
- **Decline**: Red (`#e74c3c`) for negative changes

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Purple/Blue Gradient Background (Full Page)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Blue Header                                      │  │
│  │  Cycling Performance Report                      │  │
│  │  Athlete: [Name] | Generated: [Date]             │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Content Area (White)                            │  │
│  │                                                   │  │
│  │  ┌─ Athlete Profile ─────────────────────────┐   │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐         │   │  │
│  │  │  │  Age   │ │  FTP   │ │ W/kg   │  ...    │   │  │
│  │  │  │  45    │ │ 280 W  │ │ 3.5    │         │   │  │
│  │  │  └────────┘ └────────┘ └────────┘         │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─ Performance Comparison ──────────────────┐   │  │
│  │  │  Metric    Recent  Previous  Change       │   │  │
│  │  │  ───────────────────────────────────────  │   │  │
│  │  │  Rides     120     110       ↑ +9.1%      │   │  │
│  │  │  Distance  5200km  4800km    ↑ +8.3%      │   │  │
│  │  │  Power     185W    178W      ↑ +3.8%      │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─ Time in Zones ───────────────────────────┐   │  │
│  │  │  Zone  Time (hrs)  Percentage             │   │  │
│  │  │  Z1    72.3h       40.1%                   │   │  │
│  │  │  Z2    68.2h       37.8%                   │   │  │
│  │  │  Z3    24.5h       13.6%                   │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─ Key Trends ──────────────────────────────┐   │  │
│  │  │  ① Increased Training Volume: Your        │   │  │
│  │  │     total ride count increased by 9.1%... │   │  │
│  │  │  ② Improved Average Power: A 3.8%         │   │  │
│  │  │     increase demonstrates meaningful...   │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─ Insights ────────────────────────────────┐   │  │
│  │  │  ① Polarization Analysis: Your current    │   │  │
│  │  │     78/14/8 distribution is close to...   │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─ Recommendations ─────────────────────────┐   │  │
│  │  │  ✓ Add Structured Threshold Intervals     │   │  │
│  │  │  ✓ Maintain Current Volume                │   │  │
│  │  │  ✓ Test Century Pace                      │   │  │
│  │  └───────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Section Details

### 1. Athlete Profile
- **Layout**: Responsive grid (auto-fit, min 250px)
- **Cards**: Gradient background (#f5f7fa → #c3cfe2)
- **Left Border**: 4px blue accent
- **Hover Effect**: Lift up with shadow
- **Typography**:
  - Label: Small caps, gray
  - Value: Large, bold, blue

### 2. Performance Comparison Table
- **Header**: Purple gradient background, white text
- **Rows**: Hover highlights with light gray
- **Changes**:
  - Green with ↑ for positive
  - Red with ↓ for negative
- **Typography**: Consistent padding, aligned columns

### 3. Time in Zones
- **Format**: Clean table or info box
- **Styling**: Same as comparison table
- **Fallback**: Yellow info box if data not available

### 4. Key Trends (Numbered List)
- **Format**: Ordered list with styled numbers
- **Numbers**: Circular badges with gradient background
- **Text**: Bold headings, regular body
- **Spacing**: Generous padding for readability

### 5. Insights (Numbered List)
- **Same styling as Key Trends**
- **Purpose**: Deeper coaching observations
- **Layout**: Left-aligned with numbered badges

### 6. Recommendations (Bullet List)
- **Bullets**: Green checkmarks in circles
- **Items**: Action-oriented statements
- **Styling**: Similar card background to numbered lists

### 7. Training Plan (Optional)
- **Summary**: 4-column grid of key metrics
- **Details**: Monospace text in gray box
- **Metrics**: Same card style as athlete profile

## Responsive Design

### Desktop (>768px)
- Full grid layouts (2-4 columns)
- Wide container (1200px max)
- Generous spacing

### Mobile (<768px)
- Single column layouts
- Smaller header text
- Reduced padding
- Full-width cards

## Print Styles

When printing:
- Remove background gradients
- Black text on white
- Hide navigation elements
- Avoid page breaks inside sections

## Interactive Features

Current implementation is static HTML/CSS. Future enhancements could add:
- Collapsible sections
- Chart.js visualizations
- Export to PDF button
- Dark mode toggle
- Custom color themes

## Browser Compatibility

Supports all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS/Android)

Uses standard CSS Grid, Flexbox, and CSS3 features. No JavaScript required.

## Accessibility

- Semantic HTML5 elements
- Proper heading hierarchy
- High contrast ratios
- Readable font sizes
- Screen reader friendly
- Keyboard navigable

## File Size

Typical report:
- HTML + CSS: ~25-30KB
- No external dependencies
- Self-contained single file
- Fast load time

## Example Usage

```bash
# Generate report from command line
cycling-ai generate \
  --csv ~/data/activities.csv \
  --profile ~/data/athlete.json \
  --output ~/reports/

# View report
open ~/reports/performance_report.html
```

The generated report is a self-contained HTML file that can be:
- Emailed to coaches/athletes
- Viewed offline
- Printed
- Archived for comparison
- Shared via web hosting
