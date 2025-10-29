# Testing the HTML Training Plan Viewer

## Quick Start

The HTML viewer needs to be served via HTTP (not opened directly as `file://`) to load the JSON data.

### Method 1: Python HTTP Server (Recommended)

```bash
# 1. Generate the report
python3 scripts/test_integrated_report_prep.py

# 2. Start a local web server in the output directory
cd /tmp/cycling_DEBUG_WITH_LOGGING_1
python3 -m http.server 8000

# 3. Open in browser
# Navigate to: http://localhost:8000/training_plan_viewer.html
```

### Method 2: Using Full Workflow

```bash
# Set your API key
export ANTHROPIC_API_KEY='your-key-here'

# Run the complete workflow
.venv/bin/cycling-ai generate \
  --profile /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json \
  --fit-dir /Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities \
  --output-dir /tmp/cycling_report \
  --skip-data-prep

# Start server in output directory
cd /tmp/cycling_report
python3 -m http.server 8000

# Open: http://localhost:8000/training_plan_viewer.html
```

## Why Use a Web Server?

**The Problem:**
When you open an HTML file directly (`file:///path/to/file.html`), browsers restrict JavaScript from loading other local files due to CORS (Cross-Origin Resource Security) policy.

**The Solution:**
A local web server serves files via HTTP protocol, which allows JavaScript to fetch the JSON data.

## Testing Checklist

Once the viewer opens in your browser, verify:

### ✅ Initial Load
- [ ] Page loads without errors
- [ ] Header displays "Cycling Training Plan Viewer"
- [ ] Athlete selector dropdown appears

### ✅ Athlete Profile Card
- [ ] Athlete name displays correctly
- [ ] FTP values show (Current → Target)
- [ ] Age and weight display
- [ ] Training plan duration shows

### ✅ Calendar Grid
- [ ] 12 weeks displayed
- [ ] Week numbers (1-12) visible
- [ ] Phase badges show (Foundation, Build, Peak, Recovery)
- [ ] Workout cells display:
  - [ ] Workout names
  - [ ] Durations
  - [ ] Colored intensity indicators
- [ ] Rest days marked clearly

### ✅ Workout Details (Click any workout)
- [ ] Modal opens smoothly
- [ ] Workout name and day display in header
- [ ] Total duration and TSS show
- [ ] **SVG power profile chart displays** ← Key test!
- [ ] Segment breakdown lists all segments:
  - [ ] Duration for each segment
  - [ ] Power ranges (e.g., "234-247W")
  - [ ] Descriptions (e.g., "Warm-up 15 min")
  - [ ] Correct colors (warmup=gray, interval=red, etc.)
- [ ] Close button (×) works
- [ ] Pressing Escape closes modal

### ✅ SVG Visualization (Important!)
The SVG should show:
- [ ] Grid lines (horizontal dashed lines)
- [ ] FTP reference line (purple dashed)
- [ ] Colored bars for each segment:
  - [ ] Gray for warmup/cooldown
  - [ ] Green for recovery/steady
  - [ ] Orange for tempo
  - [ ] Red for threshold/intervals
  - [ ] Purple for VO2 max
- [ ] Bar heights proportional to power
- [ ] Smooth, professional appearance

### ✅ Multi-Athlete (if applicable)
- [ ] Dropdown shows all athletes
- [ ] Selecting different athlete updates:
  - [ ] Profile card
  - [ ] Calendar
  - [ ] All workout data

### ✅ Responsive Design
Test at different screen sizes:
- [ ] Desktop (> 1200px): Full 7-column layout
- [ ] Tablet (768-1200px): Condensed layout
- [ ] Mobile (< 768px): Stacked/scrollable

## Troubleshooting

### Error: "Failed to fetch"

**Cause:** Opening HTML file directly (file://) instead of via HTTP server

**Solution:**
```bash
cd /tmp/cycling_DEBUG_WITH_LOGGING_1
python3 -m http.server 8000
# Then open: http://localhost:8000/training_plan_viewer.html
```

### Error: "No athletes found"

**Cause:** `report_data.json` is missing or invalid

**Solution:**
```bash
# Verify files exist
ls -lh /tmp/cycling_DEBUG_WITH_LOGGING_1/
# Should show both:
# - report_data.json
# - training_plan_viewer.html

# Verify JSON is valid
python3 -c "import json; json.load(open('/tmp/cycling_DEBUG_WITH_LOGGING_1/report_data.json'))"
```

### SVG Not Displaying

**Check browser console (F12):**
- Look for JavaScript errors
- Check if `generateWorkoutSVG` function exists
- Verify segments data is present

**Debug:**
```javascript
// In browser console:
console.log(reportData.athletes[0].training_plan.weekly_workouts[0].workouts);
// Should show workouts with segments array
```

### Calendar Not Rendering

**Verify data structure:**
```bash
python3 -c "
import json
data = json.load(open('/tmp/cycling_DEBUG_WITH_LOGGING_1/report_data.json'))
print('Athletes:', len(data['athletes']))
print('Weeks:', len(data['athletes'][0]['training_plan']['weekly_workouts']))
"
```

## Browser DevTools Tips

### Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for `report_data.json` request
   - Status should be 200 (OK)
   - Size should be ~76 KB

### Check Console Tab
- Should show: "Report data loaded successfully"
- Should NOT show any errors in red

### Inspect Elements
- Right-click on SVG chart
- Select "Inspect"
- Verify `<svg>` element is present with `<rect>` children

## Alternative: Using Node/npm

If you have Node.js installed:

```bash
# Install simple http server
npm install -g http-server

# Navigate to output directory
cd /tmp/cycling_DEBUG_WITH_LOGGING_1

# Start server
http-server -p 8000

# Open: http://localhost:8000/training_plan_viewer.html
```

## Test Script

Here's a complete test script you can run:

```bash
#!/bin/bash

# Generate report
echo "Generating report..."
python3 scripts/test_integrated_report_prep.py

# Navigate to output
cd /tmp/cycling_DEBUG_WITH_LOGGING_1

# Verify files
echo "Checking files..."
if [ -f "report_data.json" ] && [ -f "training_plan_viewer.html" ]; then
    echo "✓ Both files present"
else
    echo "✗ Missing files!"
    exit 1
fi

# Validate JSON
echo "Validating JSON..."
python3 -c "import json; json.load(open('report_data.json'))" && echo "✓ JSON valid" || echo "✗ JSON invalid"

# Start server
echo ""
echo "Starting web server..."
echo "Open browser to: http://localhost:8000/training_plan_viewer.html"
echo "Press Ctrl+C to stop server"
python3 -m http.server 8000
```

Save as `test_viewer.sh` and run:
```bash
chmod +x test_viewer.sh
./test_viewer.sh
```

## Expected Behavior

### On Load
1. Page displays header with gradient
2. Athlete selector populates
3. Athlete profile card shows metrics
4. 12-week calendar grid appears
5. All 44 workouts visible across weeks
6. Console shows "Report data loaded successfully"

### On Workout Click
1. Modal fades in smoothly
2. Header shows workout name and day
3. **SVG chart renders immediately** (no delay)
4. Segment list populates below chart
5. Colors match segment types
6. All data accurate

### Performance
- Initial load: < 1 second
- Modal open: < 100ms
- SVG generation: < 10ms
- Smooth 60fps animations

## What to Look For

### Visual Quality
- Professional appearance
- Consistent colors (orange/teal/yellow theme)
- Clean typography
- Proper spacing
- No layout shifts

### Functionality
- All clickable elements work
- Smooth transitions
- Keyboard shortcuts (Escape)
- No broken features

### Data Accuracy
- FTP values correct
- Week counts match
- Workout durations accurate
- Power zones reasonable
- Phase labels correct

## Common Issues

### Port Already in Use

```bash
# Error: Address already in use
# Solution: Use different port
python3 -m http.server 8001
# Then open: http://localhost:8001/training_plan_viewer.html
```

### Browser Cache

If changes don't appear:
```
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Clear cache in DevTools
3. Open in incognito/private window
```

### JSON Parse Error

```bash
# Validate JSON structure
python3 scripts/validate_report_data.py /tmp/cycling_DEBUG_WITH_LOGGING_1/report_data.json
```

## Success Criteria

You know it's working when:

1. ✅ Page loads without errors
2. ✅ Athlete data displays correctly
3. ✅ 12-week calendar visible
4. ✅ **SVG charts render in modals** ← This confirms client-side generation!
5. ✅ All interactions smooth
6. ✅ Professional appearance
7. ✅ No console errors

## Next Steps After Testing

Once everything works:

1. **Share the report:**
   - Copy entire output directory
   - Send as ZIP file
   - Recipient can open with any web server

2. **Integrate into workflow:**
   - Use in production with `cycling-ai generate`
   - Automatically creates viewer + data

3. **Customize if needed:**
   - Edit colors in HTML file
   - Adjust SVG generation
   - Add custom branding

## Summary

**Quick Test:**
```bash
python3 scripts/test_integrated_report_prep.py
cd /tmp/cycling_DEBUG_WITH_LOGGING_1
python3 -m http.server 8000
# Open: http://localhost:8000/training_plan_viewer.html
```

**What to Verify:**
- SVG charts render correctly (proves client-side generation works!)
- All 44 workouts display
- Modal interactions smooth
- Data accurate

**Common Issue:**
Don't open HTML directly - use HTTP server to avoid CORS errors.

That's it! The viewer should now work perfectly. 🚀
