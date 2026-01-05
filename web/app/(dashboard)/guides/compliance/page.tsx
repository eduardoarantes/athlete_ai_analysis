'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  Heart,
  Info,
  Lightbulb,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'

export default function ComplianceGuidePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Workout Compliance Analysis</h1>
        <p className="text-lg text-muted-foreground">
          Understanding how we measure your workout execution
        </p>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            What is Compliance Analysis?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            When you complete a ride, our system compares your actual performance against what was
            planned in your training schedule. This gives you objective feedback on how well you
            executed the workout.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <Target className="h-8 w-8 mb-2 text-primary" />
              <h4 className="font-medium">Matches Segments</h4>
              <p className="text-sm text-muted-foreground">
                Identifies each part of your workout (warmup, intervals, recovery)
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <BarChart3 className="h-8 w-8 mb-2 text-primary" />
              <h4 className="font-medium">Scores Performance</h4>
              <p className="text-sm text-muted-foreground">
                Evaluates power accuracy, time in zone, and duration
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 bg-muted/50 rounded-lg">
              <Lightbulb className="h-8 w-8 mb-2 text-primary" />
              <h4 className="font-medium">Provides Feedback</h4>
              <p className="text-sm text-muted-foreground">
                AI coach explains what went well and what to improve
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            How It Works
          </CardTitle>
          <CardDescription>The analysis process from start to finish</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Gather Your Data</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  We collect your FTP, your planned workout segments, and your actual power data
                  from Strava.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">Your FTP</Badge>
                  <Badge variant="outline">Planned Workout</Badge>
                  <Badge variant="outline">Strava Power Data</Badge>
                </div>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-muted h-6" />

            {/* Step 2 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Calculate Your Zones</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on your FTP, we calculate your personal power zones. These zones define the
                  intensity levels for your training.
                </p>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-muted h-6" />

            {/* Step 3 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Detect Your Effort Patterns</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  We analyze your power stream to identify where you actually performed each effort.
                  This accounts for starting late, taking extra recovery, or varying your pacing.
                </p>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-muted h-6" />

            {/* Step 4 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Match & Score</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Each planned segment is matched to what you actually did, and scored on power
                  accuracy, zone compliance, and duration.
                </p>
              </div>
            </div>

            <div className="ml-4 border-l-2 border-muted h-6" />

            {/* Step 5 */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                5
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Generate Feedback</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Our AI coach reviews the analysis and provides personalized feedback on what you
                  did well and what to work on next time.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Power Zones Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Power Training Zones
          </CardTitle>
          <CardDescription>Based on your Functional Threshold Power (FTP)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Your <strong>FTP</strong> is the highest power you can sustain for about one hour. All
            your training zones are calculated as percentages of this number.
          </p>

          <div className="space-y-3">
            {/* Zone 1 */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                Z1
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Active Recovery</h4>
                  <Badge variant="outline" className="text-xs">
                    &lt; 55% FTP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Very easy spinning. You can chat easily with friends.
                </p>
              </div>
            </div>

            {/* Zone 2 */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                Z2
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Endurance</h4>
                  <Badge variant="outline" className="text-xs">
                    55-75% FTP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Comfortable pace for long rides. Can hold a conversation.
                </p>
              </div>
            </div>

            {/* Zone 3 */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold">
                Z3
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Tempo / Sweet Spot</h4>
                  <Badge variant="outline" className="text-xs">
                    76-90% FTP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Moderate effort. Conversation becomes difficult.
                </p>
              </div>
            </div>

            {/* Zone 4 */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                Z4
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Threshold</h4>
                  <Badge variant="outline" className="text-xs">
                    91-105% FTP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Hard but sustainable. Only a few words at a time.
                </p>
              </div>
            </div>

            {/* Zone 5 */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
                Z5
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">VO2max and Above</h4>
                  <Badge variant="outline" className="text-xs">
                    &gt; 105% FTP
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Very hard to maximal effort. Cannot speak.
                </p>
              </div>
            </div>
          </div>

          {/* Example Calculation */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Example: If your FTP is 250 watts
            </h4>
            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              <div>
                <div className="font-medium text-blue-600 dark:text-blue-400">Z1</div>
                <div className="text-muted-foreground">0-137W</div>
              </div>
              <div>
                <div className="font-medium text-green-600 dark:text-green-400">Z2</div>
                <div className="text-muted-foreground">138-187W</div>
              </div>
              <div>
                <div className="font-medium text-yellow-600 dark:text-yellow-400">Z3</div>
                <div className="text-muted-foreground">188-225W</div>
              </div>
              <div>
                <div className="font-medium text-orange-600 dark:text-orange-400">Z4</div>
                <div className="text-muted-foreground">226-262W</div>
              </div>
              <div>
                <div className="font-medium text-red-600 dark:text-red-400">Z5</div>
                <div className="text-muted-foreground">263W+</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heart Rate Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Heart Rate Zones
          </CardTitle>
          <CardDescription>Based on your Lactate Threshold Heart Rate (LTHR)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Your <strong>LTHR</strong> is your heart rate at lactate threshold - the point where
            lactate starts building up faster than your body can clear it. This is typically
            measured during a 30-minute time trial.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Zone</th>
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">% of LTHR</th>
                  <th className="text-left py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium text-blue-600 dark:text-blue-400">Z1</td>
                  <td className="py-2 px-3">Active Recovery</td>
                  <td className="py-2 px-3">&lt; 81%</td>
                  <td className="py-2 px-3 text-muted-foreground">Very easy</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium text-green-600 dark:text-green-400">Z2</td>
                  <td className="py-2 px-3">Endurance</td>
                  <td className="py-2 px-3">81-89%</td>
                  <td className="py-2 px-3 text-muted-foreground">Aerobic base building</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium text-yellow-600 dark:text-yellow-400">Z3</td>
                  <td className="py-2 px-3">Tempo</td>
                  <td className="py-2 px-3">90-93%</td>
                  <td className="py-2 px-3 text-muted-foreground">Muscular endurance</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3 font-medium text-orange-600 dark:text-orange-400">Z4</td>
                  <td className="py-2 px-3">Threshold</td>
                  <td className="py-2 px-3">94-99%</td>
                  <td className="py-2 px-3 text-muted-foreground">Lactate threshold</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-red-600 dark:text-red-400">Z5</td>
                  <td className="py-2 px-3">VO2max</td>
                  <td className="py-2 px-3">100%+</td>
                  <td className="py-2 px-3 text-muted-foreground">Anaerobic capacity</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Segment Matching Explained */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Intelligent Segment Matching
          </CardTitle>
          <CardDescription>How we find your actual efforts within the ride</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <h4 className="font-medium mb-2">Why Pattern-Based Matching?</h4>
            <p className="text-sm text-muted-foreground">
              Athletes rarely execute workouts exactly as written. You might start an interval a
              minute late, take longer recovery, or skip a segment entirely. Our algorithm
              intelligently detects where each effort <em>actually</em> happened, not just where it
              was supposed to happen.
            </p>
          </div>

          <div className="border-t" />

          <div className="space-y-4">
            <h4 className="font-medium">The Matching Process (Simplified)</h4>

            <div className="p-4 bg-muted/50 rounded-lg font-mono text-sm space-y-2">
              <p className="text-muted-foreground italic">
                {'//'} Here&apos;s what our algorithm does, step by step:
              </p>
              <p>
                <span className="text-blue-600 dark:text-blue-400">Step 1:</span> Look at your power
                data second-by-second
              </p>
              <p>
                <span className="text-blue-600 dark:text-blue-400">Step 2:</span> Smooth out the
                noise (30-second rolling average)
              </p>
              <p>
                <span className="text-blue-600 dark:text-blue-400">Step 3:</span> Classify each
                second into a power zone (Z1-Z5)
              </p>
              <p>
                <span className="text-blue-600 dark:text-blue-400">Step 4:</span> Find where the
                zone changes significantly (effort blocks)
              </p>
              <p>
                <span className="text-blue-600 dark:text-blue-400">Step 5:</span> Match each planned
                segment to the best-fitting effort block
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h5 className="font-medium mb-2 text-green-600 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  What We Handle Well
                </h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Starting intervals early or late
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Longer or shorter recovery periods
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Skipping segments (traffic, fatigue)
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Adding extra warmup time
                  </li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h5 className="font-medium mb-2 text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  What Affects Accuracy
                </h5>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Very short intervals (&lt;30 sec)
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Highly variable outdoor conditions
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Missing power data sections
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Radically different workout execution
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            How We Calculate Your Score
          </CardTitle>
          <CardDescription>
            Three factors combine to give you an overall compliance score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Three Score Components */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Power Score</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Was your average power in the target range?
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded">
                <p>
                  <strong>100 points:</strong> Within target range
                </p>
                <p>
                  <strong>Penalty:</strong> 2 pts per watt below target
                </p>
                <p>
                  <strong>Penalty:</strong> 1 pt per watt above (less harsh)
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Zone Score</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                What percentage of time were you in the correct zone?
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded">
                <p>
                  <strong>90%+:</strong> Excellent discipline
                </p>
                <p>
                  <strong>75-89%:</strong> Good discipline
                </p>
                <p>
                  <strong>50-74%:</strong> Inconsistent
                </p>
                <p>
                  <strong>&lt;50%:</strong> Needs work
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <h4 className="font-medium">Duration Score</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Did the segment last as long as planned?
              </p>
              <div className="text-xs bg-muted/50 p-2 rounded">
                <p>
                  <strong>95-105%:</strong> Perfect timing
                </p>
                <p>
                  <strong>80-120%:</strong> Good
                </p>
                <p>
                  <strong>60-140%:</strong> Fair
                </p>
                <p>
                  <strong>Outside:</strong> Significant deviation
                </p>
              </div>
            </div>
          </div>

          {/* Weighting by Segment Type */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3">Score Weights by Segment Type</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Different segment types prioritize different factors:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Segment Type</th>
                    <th className="text-center py-2 px-3">Power</th>
                    <th className="text-center py-2 px-3">Zone</th>
                    <th className="text-center py-2 px-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium">Warmup / Cooldown</td>
                    <td className="py-2 px-3 text-center">25%</td>
                    <td className="py-2 px-3 text-center">35%</td>
                    <td className="py-2 px-3 text-center text-primary font-medium">40%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium">Intervals / Hard Efforts</td>
                    <td className="py-2 px-3 text-center text-primary font-medium">45%</td>
                    <td className="py-2 px-3 text-center text-primary font-medium">40%</td>
                    <td className="py-2 px-3 text-center">15%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium">Recovery</td>
                    <td className="py-2 px-3 text-center">20%</td>
                    <td className="py-2 px-3 text-center">30%</td>
                    <td className="py-2 px-3 text-center text-primary font-medium">50%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Steady / Tempo</td>
                    <td className="py-2 px-3 text-center">40%</td>
                    <td className="py-2 px-3 text-center">40%</td>
                    <td className="py-2 px-3 text-center">20%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grade Scale */}
          <div>
            <h4 className="font-medium mb-3">Grade Scale</h4>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">A</span>
                <span className="text-sm">90-100</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">B</span>
                <span className="text-sm">80-89</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">C</span>
                <span className="text-sm">70-79</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">D</span>
                <span className="text-sm">60-69</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">F</span>
                <span className="text-sm">0-59</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worked Example */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Example: Sweet Spot Workout Analysis
          </CardTitle>
          <CardDescription>A complete walkthrough with real numbers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Athlete Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Athlete Profile</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">FTP:</span>
                <span className="ml-2 font-medium">250W</span>
              </div>
              <div>
                <span className="text-muted-foreground">LTHR:</span>
                <span className="ml-2 font-medium">165 bpm</span>
              </div>
            </div>
          </div>

          {/* Planned vs Actual */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Planned Workout (50 min)
              </h4>
              <ol className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">1</Badge>
                  <span>Warmup: 10 min @ 50-60% FTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">2</Badge>
                  <span>Interval: 10 min @ 88-93% FTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">3</Badge>
                  <span>Recovery: 5 min @ 50-55% FTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">4</Badge>
                  <span>Interval: 10 min @ 88-93% FTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">5</Badge>
                  <span>Recovery: 5 min @ 50-55% FTP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Badge className="w-6 justify-center">6</Badge>
                  <span>Cooldown: 10 min @ 50-60% FTP</span>
                </li>
              </ol>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                What Actually Happened (48 min)
              </h4>
              <ol className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    1
                  </Badge>
                  <span>
                    Warmup: <strong>8 min</strong> @ 145W avg
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Short
                  </Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    2
                  </Badge>
                  <span>
                    Interval: <strong>10 min</strong> @ 222W avg
                  </span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    3
                  </Badge>
                  <span>
                    Recovery: <strong>4 min</strong> @ 137W avg
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Short
                  </Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    4
                  </Badge>
                  <span>
                    Interval: <strong>11 min</strong> @ 228W avg
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    Long
                  </Badge>
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    5
                  </Badge>
                  <span>
                    Recovery: <strong>5 min</strong> @ 137W avg
                  </span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    6
                  </Badge>
                  <span>
                    Cooldown: <strong>10 min</strong> @ 134W avg
                  </span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </li>
              </ol>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Segment</th>
                  <th className="text-center py-2 px-3">Power</th>
                  <th className="text-center py-2 px-3">Zone</th>
                  <th className="text-center py-2 px-3">Duration</th>
                  <th className="text-center py-2 px-3">Score</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-3">Warmup</td>
                  <td className="py-2 px-3 text-center">95</td>
                  <td className="py-2 px-3 text-center">85</td>
                  <td className="py-2 px-3 text-center text-orange-500">60</td>
                  <td className="py-2 px-3 text-center font-medium">78</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Interval 1</td>
                  <td className="py-2 px-3 text-center text-green-500">100</td>
                  <td className="py-2 px-3 text-center">75</td>
                  <td className="py-2 px-3 text-center text-green-500">100</td>
                  <td className="py-2 px-3 text-center font-medium text-green-600 dark:text-green-400">
                    90
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Recovery 1</td>
                  <td className="py-2 px-3 text-center">95</td>
                  <td className="py-2 px-3 text-center">95</td>
                  <td className="py-2 px-3 text-center text-orange-500">50</td>
                  <td className="py-2 px-3 text-center font-medium">75</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Interval 2</td>
                  <td className="py-2 px-3 text-center">98</td>
                  <td className="py-2 px-3 text-center">70</td>
                  <td className="py-2 px-3 text-center">92</td>
                  <td className="py-2 px-3 text-center font-medium text-blue-600 dark:text-blue-400">
                    88
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-3">Recovery 2</td>
                  <td className="py-2 px-3 text-center">95</td>
                  <td className="py-2 px-3 text-center text-green-500">100</td>
                  <td className="py-2 px-3 text-center text-green-500">100</td>
                  <td className="py-2 px-3 text-center font-medium text-green-600 dark:text-green-400">
                    95
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">Cooldown</td>
                  <td className="py-2 px-3 text-center">90</td>
                  <td className="py-2 px-3 text-center">85</td>
                  <td className="py-2 px-3 text-center text-green-500">100</td>
                  <td className="py-2 px-3 text-center font-medium text-green-600 dark:text-green-400">
                    90
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/50">
                  <td className="py-3 px-3 font-bold" colSpan={4}>
                    Overall Score (Duration-Weighted)
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">86</span>
                    <Badge variant="outline" className="ml-2">
                      Grade B
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Coach Feedback */}
          <div className="p-4 border-l-4 border-primary bg-primary/5 rounded-r-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI Coach Feedback
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              &ldquo;Good Sweet Spot session! You executed the main intervals well, staying in the
              target power range. Your warmup was a bit short and you cut some recovery periods -
              this could lead to accumulated fatigue.&rdquo;
            </p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-green-600 dark:text-green-400 mb-1">
                  What went well:
                </h5>
                <ul className="text-muted-foreground space-y-1">
                  <li>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Hit target power for both intervals
                  </li>
                  <li>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Good pacing throughout
                  </li>
                  <li>
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Proper cooldown to finish
                  </li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-orange-600 dark:text-orange-400 mb-1">
                  To improve:
                </h5>
                <ul className="text-muted-foreground space-y-1">
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Extend warmup to full 10 minutes
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Take full recovery periods
                  </li>
                  <li>
                    <ChevronRight className="h-3 w-3 inline mr-1" />
                    Stay consistently in Z3 during Sweet Spot
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glossary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Glossary
          </CardTitle>
          <CardDescription>Key terms explained</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="font-medium">FTP (Functional Threshold Power)</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                The highest power you can sustain for approximately one hour. This is your benchmark
                for calculating training zones.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">LTHR (Lactate Threshold Heart Rate)</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                Your heart rate at lactate threshold - typically measured during a 30-minute time
                trial. Used to calculate heart rate training zones.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">Power Zone</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                A range of power output that represents a specific training intensity (Z1-Z5). Each
                zone targets different physiological adaptations.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">Segment</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                A distinct portion of a workout with specific targets, such as warmup, intervals,
                recovery, or cooldown.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">Compliance Score</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                A 0-100 measure of how well your actual performance matched what was planned.
                Considers power, zone discipline, and duration.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">Normalized Power</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                A weighted average of your power that accounts for the variability of your effort.
                More representative of the physiological cost than simple average power.
              </dd>
            </div>
            <div className="border-t" />
            <div>
              <dt className="font-medium">TSS (Training Stress Score)</dt>
              <dd className="text-sm text-muted-foreground ml-4">
                A single number that represents the overall training load of a workout, considering
                both intensity and duration relative to your FTP.
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Have questions about your compliance analysis? Check out your workout history to see your
          scores over time.
        </p>
      </div>
    </div>
  )
}
