package com.cyclingai;

import com.garmin.fit.*;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * FIT file parser using Garmin FIT SDK with lenient error handling.
 * Extracts power data for time-in-zone calculations.
 *
 * This parser is more lenient than Python libraries and handles corrupted/imperfect FIT files better.
 *
 * Usage: java -jar FitZoneParser.jar <fit-file-path> <ftp-watts>
 * Output: JSON with time-in-zones data
 */
public class FitZoneParser {

    private static final long FIT_EPOCH_MS = 631065600000L; // Dec 31, 1989 00:00:00 UTC

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: java -jar FitZoneParser.jar <fit-file-path> <ftp-watts>");
            System.exit(1);
        }

        String fitFilePath = args[0];
        double ftp;

        try {
            ftp = Double.parseDouble(args[1]);
        } catch (NumberFormatException e) {
            System.out.println("{");
            System.out.println("  \"success\": false,");
            System.out.println("  \"error\": \"Invalid FTP value: " + escapeJson(args[1]) + "\"");
            System.out.println("}");
            System.exit(1);
            return;
        }

        try {
            Result result = parseFitFile(fitFilePath, ftp);

            // Output as JSON
            System.out.println("{");
            System.out.println("  \"success\": true,");
            System.out.println("  \"ftp\": " + ftp + ",");
            System.out.println("  \"total_power_seconds\": " + result.totalPowerSeconds + ",");
            System.out.println("  \"z1_active_recovery\": " + result.zones.z1 + ",");
            System.out.println("  \"z2_endurance\": " + result.zones.z2 + ",");
            System.out.println("  \"z3_tempo\": " + result.zones.z3 + ",");
            System.out.println("  \"z4_threshold\": " + result.zones.z4 + ",");
            System.out.println("  \"z5_vo2max\": " + result.zones.z5 + ",");
            System.out.println("  \"z6_anaerobic\": " + result.zones.z6 + ",");
            System.out.println("  \"avg_power\": " + result.avgPower + ",");
            System.out.println("  \"max_power\": " + result.maxPower + ",");
            System.out.println("  \"normalized_power\": " + result.normalizedPower);
            System.out.println("}");

        } catch (Exception e) {
            // Output error as JSON
            System.out.println("{");
            System.out.println("  \"success\": false,");
            System.out.println("  \"error\": \"" + escapeJson(e.getMessage()) + "\"");
            System.out.println("}");
            System.exit(1);
        }
    }

    private static Result parseFitFile(String filePath, double ftp) throws Exception {
        FileInputStream fis = new FileInputStream(filePath);
        Decode decode = new Decode();
        MesgBroadcaster mesgBroadcaster = new MesgBroadcaster(decode);

        Result result = new Result();
        result.zones = new ZoneData(ftp);

        List<Integer> powerValues = new ArrayList<>();

        // Listen for record messages (contains second-by-second power data)
        mesgBroadcaster.addListener(new MesgListener() {
            @Override
            public void onMesg(Mesg mesg) {
                if (mesg.getName().equals("record")) {
                    // Get power from record
                    Field powerField = mesg.getField("power");
                    if (powerField != null && powerField.getValue() != null) {
                        try {
                            int power = 0;
                            Object powerValue = powerField.getValue();

                            if (powerValue instanceof Integer) {
                                power = (Integer) powerValue;
                            } else if (powerValue instanceof Short) {
                                power = ((Short) powerValue).intValue();
                            } else if (powerValue instanceof Long) {
                                power = ((Long) powerValue).intValue();
                            }

                            if (power > 0) {
                                powerValues.add(power);
                                result.zones.addPowerValue(power);

                                // Track max
                                if (power > result.maxPower) {
                                    result.maxPower = power;
                                }
                            }
                        } catch (Exception e) {
                            // Skip corrupted power value
                        }
                    }
                }

                // Also get session-level metrics
                else if (mesg.getName().equals("session")) {
                    // Get avg_power from session
                    Field avgPowerField = mesg.getField("avg_power");
                    if (avgPowerField != null && avgPowerField.getValue() != null) {
                        try {
                            Object avgValue = avgPowerField.getValue();
                            if (avgValue instanceof Integer) {
                                result.avgPower = ((Integer) avgValue).doubleValue();
                            } else if (avgValue instanceof Short) {
                                result.avgPower = ((Short) avgValue).doubleValue();
                            }
                        } catch (Exception e) {
                            // Skip
                        }
                    }

                    // Get normalized_power from session
                    Field npField = mesg.getField("normalized_power");
                    if (npField != null && npField.getValue() != null) {
                        try {
                            Object npValue = npField.getValue();
                            if (npValue instanceof Integer) {
                                result.normalizedPower = ((Integer) npValue).doubleValue();
                            } else if (npValue instanceof Short) {
                                result.normalizedPower = ((Short) npValue).doubleValue();
                            }
                        } catch (Exception e) {
                            // Skip
                        }
                    }
                }
            }
        });

        // Read the FIT file
        try {
            decode.read(fis, mesgBroadcaster, mesgBroadcaster);
        } catch (Exception e) {
            // Be lenient with decode errors - we may have already extracted useful data
        } finally {
            fis.close();
        }

        // Calculate avg power if not from session
        if (result.avgPower == 0 && !powerValues.isEmpty()) {
            long sum = 0;
            for (int p : powerValues) {
                sum += p;
            }
            result.avgPower = (double) sum / powerValues.size();
        }

        result.totalPowerSeconds = powerValues.size();

        return result;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    static class ZoneData {
        int z1 = 0;  // 0-55% FTP
        int z2 = 0;  // 56-75% FTP
        int z3 = 0;  // 76-90% FTP
        int z4 = 0;  // 91-105% FTP
        int z5 = 0;  // 106-120% FTP
        int z6 = 0;  // >120% FTP

        double ftp;
        double z1Max, z2Max, z3Max, z4Max, z5Max;

        ZoneData(double ftp) {
            this.ftp = ftp;
            this.z1Max = ftp * 0.55;
            this.z2Max = ftp * 0.75;
            this.z3Max = ftp * 0.90;
            this.z4Max = ftp * 1.05;
            this.z5Max = ftp * 1.20;
        }

        void addPowerValue(int power) {
            if (power <= z1Max) {
                z1++;
            } else if (power <= z2Max) {
                z2++;
            } else if (power <= z3Max) {
                z3++;
            } else if (power <= z4Max) {
                z4++;
            } else if (power <= z5Max) {
                z5++;
            } else {
                z6++;
            }
        }
    }

    static class Result {
        ZoneData zones;
        int totalPowerSeconds = 0;
        double avgPower = 0;
        int maxPower = 0;
        double normalizedPower = 0;
    }
}
