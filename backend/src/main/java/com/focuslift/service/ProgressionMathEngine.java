package com.focuslift.service;

import com.focuslift.domain.enums.SetType;
import com.focuslift.domain.model.Exercise;
import com.focuslift.domain.model.Workout;
import com.focuslift.domain.model.WorkoutSet;
import com.focuslift.dto.aicoach.PlateauExerciseDto;
import com.focuslift.dto.aicoach.ProgressionMetricDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
public class ProgressionMathEngine {

    /**
     * Calcula o 1RM estimado pela formula de Brzycki com limitacao de seguranca em 12 repeticoes:
     * 1RM = weight * (36 / (37 - min(reps, 12)))
     */
    public double calculateBrzycki1Rm(double weight, int reps) {
        if (weight <= 0 || reps <= 0) return 0.0;
        if (reps == 1) return roundOneDecimal(weight);

        int boundedReps = Math.min(reps, 12);
        double est = weight * (36.0 / (37.0 - boundedReps));
        return roundOneDecimal(est);
    }

    /**
     * Analisa o volume total de carga nas duas ultimas semanas (semana atual vs semana anterior).
     */
    public WeeklyVolumeAnalysis analyzeWeeklyVolumes(List<Workout> workouts) {
        if (workouts == null || workouts.isEmpty()) {
            return new WeeklyVolumeAnalysis(0.0, 0.0, 0.0);
        }

        LocalDate now = LocalDate.now();
        double currentWeekVolume = 0.0;
        double previousWeekVolume = 0.0;

        for (Workout w : workouts) {
            if (w.getDate() == null || w.getDate().isBlank()) continue;
            try {
                LocalDate workoutDate = LocalDate.parse(w.getDate().trim());
                long daysAgo = ChronoUnit.DAYS.between(workoutDate, now);

                double vol = calculateWorkoutVolume(w);

                if (daysAgo >= 0 && daysAgo <= 7) {
                    currentWeekVolume += vol;
                } else if (daysAgo > 7 && daysAgo <= 14) {
                    previousWeekVolume += vol;
                }
            } catch (Exception ignored) {}
        }

        double deltaPercent = 0.0;
        if (previousWeekVolume > 0) {
            deltaPercent = ((currentWeekVolume - previousWeekVolume) / previousWeekVolume) * 100.0;
        }

        return new WeeklyVolumeAnalysis(
                roundOneDecimal(currentWeekVolume),
                roundOneDecimal(previousWeekVolume),
                roundOneDecimal(deltaPercent)
        );
    }

    /**
     * Calcula as principais progressoes de carga (1RM e carga bruta) entre o ultimo treino e o penultimo.
     * Desconsidera series de aquecimento (WARMUP) para nao distorcer metricas de sobrecarga.
     */
    public List<ProgressionMetricDto> calculateTopProgressions(List<Workout> workouts) {
        if (workouts == null || workouts.isEmpty()) return List.of();

        // Mapeia historico cronologico de cada exercicio
        Map<String, List<ExerciseSessionSnapshot>> exerciseHistory = new HashMap<>();

        // Ordena treinos por data ascendente para avaliar a linha do tempo
        List<Workout> sorted = workouts.stream()
                .filter(w -> w.getDate() != null && !w.getDate().isBlank())
                .sorted(Comparator.comparing(Workout::getDate))
                .toList();

        for (Workout w : sorted) {
            if (w.getExercises() == null) continue;
            for (Exercise ex : w.getExercises()) {
                if (ex.getName() == null || ex.getName().isBlank()) continue;
                String normalizedName = ex.getName().trim();

                double topWeight = 0.0;
                int topReps = 0;
                double best1Rm = 0.0;

                if (ex.getSets() != null) {
                    for (WorkoutSet s : ex.getSets()) {
                        if (s.getSetType() == SetType.WARMUP) continue;

                        double weight = s.getWeight() != null ? s.getWeight().doubleValue() : 0.0;
                        int reps = s.getReps() != null ? s.getReps() : 0;
                        double est1Rm = calculateBrzycki1Rm(weight, reps);

                        if (est1Rm > best1Rm) best1Rm = est1Rm;
                        if (weight > topWeight || (weight == topWeight && reps > topReps)) {
                            topWeight = weight;
                            topReps = reps;
                        }
                    }
                }

                if (topWeight > 0 && topReps > 0) {
                    exerciseHistory.computeIfAbsent(normalizedName, k -> new ArrayList<>())
                            .add(new ExerciseSessionSnapshot(
                                    normalizedName,
                                    ex.getMuscleGroup() != null ? ex.getMuscleGroup() : "",
                                    w.getTitle() != null ? w.getTitle() : "",
                                    w.getDate(),
                                    topWeight,
                                    topReps,
                                    best1Rm
                            ));
                }
            }
        }

        List<ProgressionMetricDto> metrics = new ArrayList<>();

        for (Map.Entry<String, List<ExerciseSessionSnapshot>> entry : exerciseHistory.entrySet()) {
            List<ExerciseSessionSnapshot> sessions = entry.getValue();
            if (sessions.size() >= 2) {
                ExerciseSessionSnapshot latest = sessions.get(sessions.size() - 1);
                ExerciseSessionSnapshot previous = sessions.get(sessions.size() - 2);

                double deltaKg = roundOneDecimal(latest.best1Rm() - previous.best1Rm());
                double deltaPct = previous.best1Rm() > 0
                        ? roundOneDecimal(((latest.best1Rm() - previous.best1Rm()) / previous.best1Rm()) * 100.0)
                        : 0.0;

                metrics.add(new ProgressionMetricDto(
                        latest.exerciseName(),
                        latest.muscleGroup(),
                        latest.best1Rm(),
                        previous.best1Rm(),
                        deltaKg,
                        deltaPct,
                        latest.topWeight(),
                        latest.topReps(),
                        previous.topWeight(),
                        previous.topReps()
                ));
            } else if (sessions.size() == 1) {
                ExerciseSessionSnapshot only = sessions.get(0);
                metrics.add(new ProgressionMetricDto(
                        only.exerciseName(),
                        only.muscleGroup(),
                        only.best1Rm(),
                        0.0,
                        0.0,
                        0.0,
                        only.topWeight(),
                        only.topReps(),
                        0.0,
                        0
                ));
            }
        }

        // Ordena por maior evolucao percentual primeiro
        metrics.sort((a, b) -> Double.compare(b.delta1RmPercent(), a.delta1RmPercent()));
        return metrics;
    }

    /**
     * Detecta exercicios com estagnacao de carga (plato) nas ultimas sessoes da mesma ficha.
     * Requer no minimo 3 sessoes consecutivas sem ganho de 1RM com RPE medio alto (>= 8.0).
     */
    public List<PlateauExerciseDto> detectPlateaus(List<Workout> workouts) {
        if (workouts == null || workouts.size() < 3) return List.of();

        // Agrupa por combinacao (exerciseName + routineTitle)
        Map<String, List<ExerciseSessionSnapshot>> routineExerciseMap = new HashMap<>();

        List<Workout> sorted = workouts.stream()
                .filter(w -> w.getDate() != null && !w.getDate().isBlank())
                .sorted(Comparator.comparing(Workout::getDate))
                .toList();

        for (Workout w : sorted) {
            String routineTitle = w.getTitle() != null ? w.getTitle().trim() : "Treino";
            if (w.getExercises() == null) continue;

            for (Exercise ex : w.getExercises()) {
                if (ex.getName() == null || ex.getName().isBlank()) continue;
                String exName = ex.getName().trim();
                String key = exName.toLowerCase() + "|||" + routineTitle.toLowerCase();

                double topWeight = 0.0;
                int topReps = 0;
                double best1Rm = 0.0;
                double totalRpe = 0.0;
                int rpeCount = 0;

                if (ex.getSets() != null) {
                    for (WorkoutSet s : ex.getSets()) {
                        if (s.getSetType() == SetType.WARMUP) continue;

                        double weight = s.getWeight() != null ? s.getWeight().doubleValue() : 0.0;
                        int reps = s.getReps() != null ? s.getReps() : 0;
                        double est1Rm = calculateBrzycki1Rm(weight, reps);

                        if (est1Rm > best1Rm) best1Rm = est1Rm;
                        if (weight > topWeight || (weight == topWeight && reps > topReps)) {
                            topWeight = weight;
                            topReps = reps;
                        }
                        if (s.getRpe() != null && s.getRpe().doubleValue() > 0) {
                            totalRpe += s.getRpe().doubleValue();
                            rpeCount++;
                        }
                    }
                }

                if (topWeight > 0) {
                    double avgRpe = rpeCount > 0 ? (totalRpe / rpeCount) : 8.0;
                    routineExerciseMap.computeIfAbsent(key, k -> new ArrayList<>())
                            .add(new ExerciseSessionSnapshot(
                                    exName,
                                    ex.getMuscleGroup() != null ? ex.getMuscleGroup() : "",
                                    routineTitle,
                                    w.getDate(),
                                    topWeight,
                                    topReps,
                                    best1Rm,
                                    avgRpe
                            ));
                }
            }
        }

        List<PlateauExerciseDto> plateaus = new ArrayList<>();

        for (List<ExerciseSessionSnapshot> sessions : routineExerciseMap.values()) {
            if (sessions.size() >= 3) {
                // Calcula quantas sessoes consecutivas a partir da mais recente nao tiveram aumento de 1RM
                int stagnantCount = 1;
                for (int i = sessions.size() - 1; i > 0; i--) {
                    if (sessions.get(i).best1Rm() <= sessions.get(i - 1).best1Rm()) {
                        stagnantCount++;
                    } else {
                        break;
                    }
                }

                if (stagnantCount >= 3) {
                    ExerciseSessionSnapshot current = sessions.get(sessions.size() - 1);
                    // Plato requer esforco real: se avgRpe < 8.0, o atleta treinou submaximo (deload)
                    if (current.avgRpe() >= 8.0) {
                        String action;
                        if (current.avgRpe() >= 9.0) {
                            action = "Reduza 5% a 10% da carga (ou 1 série) e foque no controle excêntrico de 2 a 3 segundos com 2 a 3min de descanso.";
                        } else {
                            action = "Adicione micro-carga de +1kg a +2kg ou tente +1 repetição na primeira série mantendo 2 a 3s na descida.";
                        }

                        plateaus.add(new PlateauExerciseDto(
                                current.exerciseName(),
                                current.routineTitle(),
                                stagnantCount,
                                current.topWeight(),
                                current.topReps(),
                                roundOneDecimal(current.avgRpe()),
                                action
                        ));
                    }
                }
            }
        }

        return plateaus;
    }

    private double calculateWorkoutVolume(Workout w) {
        if (w.getTotalVolumeKg() != null && w.getTotalVolumeKg().compareTo(BigDecimal.ZERO) > 0) {
            return w.getTotalVolumeKg().doubleValue();
        }
        double sum = 0.0;
        if (w.getExercises() != null) {
            for (Exercise ex : w.getExercises()) {
                if (ex.getSets() != null) {
                    for (WorkoutSet s : ex.getSets()) {
                        if (s.getSetType() == SetType.WARMUP) continue;
                        double weight = s.getWeight() != null ? s.getWeight().doubleValue() : 0.0;
                        int reps = s.getReps() != null ? s.getReps() : 0;
                        sum += (weight * reps);
                    }
                }
            }
        }
        return sum;
    }

    private double roundOneDecimal(double val) {
        return BigDecimal.valueOf(val).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    public record WeeklyVolumeAnalysis(double currentWeekVolume, double previousWeekVolume, double deltaPercent) {}

    public enum AcwrRiskLevel {
        INSUFFICIENT_DATA,
        UNDER_TRAINING,
        OPTIMAL,
        OVERREACHING,
        DANGER_ZONE
    }

    public record AcwrAnalysis(
            double acuteVolumeKg,
            double chronicWeeklyVolumeKg,
            double ratio,
            AcwrRiskLevel riskLevel,
            String interpretation,
            String recommendation
    ) {}

    public record ExerciseProgressionTrajectory(
            String exerciseName,
            List<Double> historical1Rms,
            double initial1Rm,
            double latest1Rm,
            double totalGainKg,
            double totalGainPercent
    ) {}

    /**
     * Calcula o Acute:Chronic Workload Ratio (ACWR - Metodologia de Tim Gabbett):
     * Carga Aguda = volume total dos ultimos 7 dias (fadiga recente)
     * Carga Cronica = media semanal dos ultimos 28 dias (capacidade historica)
     * Razao ACWR = Carga Aguda / Carga Cronica
     */
    public AcwrAnalysis calculateAcwr(List<Workout> workouts) {
        if (workouts == null || workouts.isEmpty()) {
            return new AcwrAnalysis(0.0, 0.0, 0.0, AcwrRiskLevel.INSUFFICIENT_DATA,
                    "Sem dados de treino suficientes",
                    "Registre treinos com consistencia nas proximas semanas para habilitar o monitoramento de fadiga.");
        }

        LocalDate now = LocalDate.now();
        double acuteVolume = 0.0;
        double total28dVolume = 0.0;
        int workoutsIn28d = 0;

        for (Workout w : workouts) {
            if (w.getDate() == null || w.getDate().isBlank()) continue;
            try {
                LocalDate workoutDate = LocalDate.parse(w.getDate().trim());
                long daysAgo = ChronoUnit.DAYS.between(workoutDate, now);

                if (daysAgo >= 0 && daysAgo < 28) {
                    double vol = calculateWorkoutVolume(w);
                    total28dVolume += vol;
                    workoutsIn28d++;
                    if (daysAgo < 7) {
                        acuteVolume += vol;
                    }
                }
            } catch (Exception ignored) {}
        }

        if (workoutsIn28d < 2 || total28dVolume <= 0.0) {
            return new AcwrAnalysis(roundOneDecimal(acuteVolume), 0.0, 0.0, AcwrRiskLevel.INSUFFICIENT_DATA,
                    "Historico inicial insuficiente (minimo de 2 treinos no mes)",
                    "Continue registrando seus treinos regularmente.");
        }

        double chronicWeeklyVolume = total28dVolume / 4.0;
        if (chronicWeeklyVolume <= 0.0) {
            return new AcwrAnalysis(roundOneDecimal(acuteVolume), 0.0, 0.0, AcwrRiskLevel.INSUFFICIENT_DATA,
                    "Historico com volume nulo",
                    "Registre as cargas e repeticoes dos seus exercicios.");
        }

        double ratio = roundOneDecimal(acuteVolume / chronicWeeklyVolume);
        AcwrRiskLevel riskLevel;
        String interpretation;
        String recommendation;

        if (ratio < 0.8) {
            riskLevel = AcwrRiskLevel.UNDER_TRAINING;
            interpretation = "Volume agudo abaixo da media cronica (sub-recuperacao ou fase regenerativa).";
            recommendation = "Aumente gradualmente o volume para evitar destreino ou aproveite para consolidar tecnica.";
        } else if (ratio <= 1.3) {
            riskLevel = AcwrRiskLevel.OPTIMAL;
            interpretation = "Sweet Spot fisiologico (0.8 - 1.3): sobrecarga segura e maxima adaptacao hipertrofica.";
            recommendation = "Mantenha o ritmo atual com sobrecarga progressiva de +1 rep ou micro-carga de +1kg a +2kg.";
        } else if (ratio < 1.5) {
            riskLevel = AcwrRiskLevel.OVERREACHING;
            interpretation = "Sobrecarga aguda acelerada (+30% acima da base cronica). Risco moderado de fadiga.";
            recommendation = "Monitore sono e alimentacao. Se o RPE passar de 9 em varios exercicios, reduza 1 serie de trabalho.";
        } else {
            riskLevel = AcwrRiskLevel.DANGER_ZONE;
            interpretation = "Zona de Perigo (ACWR >= 1.5): pico excessivo de fadiga neuromuscular acumulada.";
            recommendation = "Risco agudo de lesao. Aplique deload leve: reduza 20% do volume na proxima semana.";
        }

        return new AcwrAnalysis(
                roundOneDecimal(acuteVolume),
                roundOneDecimal(chronicWeeklyVolume),
                ratio,
                riskLevel,
                interpretation,
                recommendation
        );
    }

    /**
     * Calcula a trajetoria de progressao de 1RM ao longo de todas as sessoes registradas de um exercicio.
     */
    public ExerciseProgressionTrajectory calculateProgressionTrajectory(List<Workout> workouts, String targetExercise) {
        if (workouts == null || workouts.isEmpty() || targetExercise == null || targetExercise.isBlank()) {
            return new ExerciseProgressionTrajectory(targetExercise != null ? targetExercise : "", List.of(), 0.0, 0.0, 0.0, 0.0);
        }

        String normalizedTarget = targetExercise.trim().toLowerCase();
        List<Workout> sorted = workouts.stream()
                .filter(w -> w.getDate() != null && !w.getDate().isBlank())
                .sorted(Comparator.comparing(Workout::getDate))
                .toList();

        List<Double> rmHistory = new ArrayList<>();

        for (Workout w : sorted) {
            if (w.getExercises() == null) continue;
            for (Exercise ex : w.getExercises()) {
                if (ex.getName() != null && ex.getName().trim().equalsIgnoreCase(normalizedTarget)) {
                    double best1Rm = 0.0;
                    if (ex.getSets() != null) {
                        for (WorkoutSet s : ex.getSets()) {
                            if (s.getSetType() == SetType.WARMUP) continue;
                            double weight = s.getWeight() != null ? s.getWeight().doubleValue() : 0.0;
                            int reps = s.getReps() != null ? s.getReps() : 0;
                            double est1Rm = calculateBrzycki1Rm(weight, reps);
                            if (est1Rm > best1Rm) best1Rm = est1Rm;
                        }
                    }
                    if (best1Rm > 0) {
                        rmHistory.add(best1Rm);
                    }
                }
            }
        }

        if (rmHistory.isEmpty()) {
            return new ExerciseProgressionTrajectory(targetExercise, List.of(), 0.0, 0.0, 0.0, 0.0);
        }

        double initial = rmHistory.get(0);
        double latest = rmHistory.get(rmHistory.size() - 1);
        double gainKg = roundOneDecimal(latest - initial);
        double gainPct = initial > 0 ? roundOneDecimal(((latest - initial) / initial) * 100.0) : 0.0;

        return new ExerciseProgressionTrajectory(targetExercise, rmHistory, initial, latest, gainKg, gainPct);
    }

    public record ExerciseSessionSnapshot(
            String exerciseName,
            String muscleGroup,
            String routineTitle,
            String date,
            double topWeight,
            int topReps,
            double best1Rm,
            double avgRpe
    ) {
        public ExerciseSessionSnapshot(String exerciseName, String muscleGroup, String routineTitle, String date, double topWeight, int topReps, double best1Rm) {
            this(exerciseName, muscleGroup, routineTitle, date, topWeight, topReps, best1Rm, 8.0);
        }
    }
}
