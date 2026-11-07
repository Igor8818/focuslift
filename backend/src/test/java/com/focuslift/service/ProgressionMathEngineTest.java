package com.focuslift.service;

import com.focuslift.domain.model.Exercise;
import com.focuslift.domain.model.Workout;
import com.focuslift.domain.model.WorkoutSet;
import com.focuslift.dto.aicoach.PlateauExerciseDto;
import com.focuslift.dto.aicoach.ProgressionMetricDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProgressionMathEngineTest {

    private ProgressionMathEngine mathEngine;

    @BeforeEach
    void setUp() {
        mathEngine = new ProgressionMathEngine();
    }

    @Test
    @DisplayName("Brzycki 1RM deve calcular com precisão matemática para repetições submáximas")
    void testCalculateBrzycki1Rm() {
        // 1 rep deve ser exatamente a própria carga
        assertThat(mathEngine.calculateBrzycki1Rm(100.0, 1)).isEqualTo(100.0);

        // 100kg x 10 reps: 100 * (36 / 27) = 133.333 -> 133.3
        assertThat(mathEngine.calculateBrzycki1Rm(100.0, 10)).isEqualTo(133.3);

        // 60kg x 6 reps: 60 * (36 / 31) = 69.677 -> 69.7
        assertThat(mathEngine.calculateBrzycki1Rm(60.0, 6)).isEqualTo(69.7);

        // Limitador seguro em 12 reps para repetições altas
        assertThat(mathEngine.calculateBrzycki1Rm(50.0, 25)).isEqualTo(mathEngine.calculateBrzycki1Rm(50.0, 12));

        // Casos de borda: peso zero ou reps negativas
        assertThat(mathEngine.calculateBrzycki1Rm(0.0, 10)).isEqualTo(0.0);
        assertThat(mathEngine.calculateBrzycki1Rm(100.0, 0)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("analyzeWeeklyVolumes deve agregar volumes de treinos e calcular delta percentual")
    void testAnalyzeWeeklyVolumes() {
        String today = LocalDate.now().toString();
        String twoDaysAgo = LocalDate.now().minusDays(2).toString();
        String tenDaysAgo = LocalDate.now().minusDays(10).toString();

        Workout w1 = new Workout(null, "w-1", "Treino A", today, null, BigDecimal.valueOf(1000));
        Workout w2 = new Workout(null, "w-2", "Treino B", twoDaysAgo, null, BigDecimal.valueOf(1200));
        // Semana anterior:
        Workout w3 = new Workout(null, "w-3", "Treino A Passado", tenDaysAgo, null, BigDecimal.valueOf(2000));

        ProgressionMathEngine.WeeklyVolumeAnalysis analysis = mathEngine.analyzeWeeklyVolumes(List.of(w1, w2, w3));

        assertThat(analysis.currentWeekVolume()).isEqualTo(2200.0);
        assertThat(analysis.previousWeekVolume()).isEqualTo(2000.0);
        // (2200 - 2000) / 2000 = +10%
        assertThat(analysis.deltaPercent()).isEqualTo(10.0);
    }

    @Test
    @DisplayName("calculateTopProgressions deve calcular a evolução de 1RM entre treinos do mesmo exercício")
    void testCalculateTopProgressions() {
        Workout w1 = new Workout(null, "w-1", "Treino Peito", "2026-10-01", null, BigDecimal.ZERO);
        Exercise ex1 = new Exercise("Supino Reto com Barra", "Peito", 90, 0);
        ex1.addSet(new WorkoutSet(BigDecimal.valueOf(80), 10, BigDecimal.valueOf(8), null, null, 0));
        w1.addExercise(ex1);

        Workout w2 = new Workout(null, "w-2", "Treino Peito", "2026-10-08", null, BigDecimal.ZERO);
        Exercise ex2 = new Exercise("Supino Reto com Barra", "Peito", 90, 0);
        ex2.addSet(new WorkoutSet(BigDecimal.valueOf(85), 10, BigDecimal.valueOf(8.5), null, null, 0));
        w2.addExercise(ex2);

        List<ProgressionMetricDto> metrics = mathEngine.calculateTopProgressions(List.of(w1, w2));

        assertThat(metrics).hasSize(1);
        ProgressionMetricDto metric = metrics.get(0);
        assertThat(metric.exerciseName()).isEqualTo("Supino Reto com Barra");
        assertThat(metric.previous1Rm()).isEqualTo(106.7); // 80 * 36/27 = 106.67
        assertThat(metric.current1Rm()).isEqualTo(113.3);  // 85 * 36/27 = 113.33
        assertThat(metric.delta1RmKg()).isGreaterThan(6.0);
        assertThat(metric.delta1RmPercent()).isGreaterThan(5.0);
    }

    @Test
    @DisplayName("detectPlateaus deve identificar 3 sessões consecutivas sem aumento de carga com RPE alto")
    void testDetectPlateaus() {
        Workout w1 = new Workout(null, "w-1", "Treino Ombro", "2026-10-01", null, BigDecimal.ZERO);
        Exercise ex1 = new Exercise("Elevação Lateral", "Ombros", 60, 0);
        ex1.addSet(new WorkoutSet(BigDecimal.valueOf(14), 10, BigDecimal.valueOf(9), null, null, 0));
        w1.addExercise(ex1);

        Workout w2 = new Workout(null, "w-2", "Treino Ombro", "2026-10-08", null, BigDecimal.ZERO);
        Exercise ex2 = new Exercise("Elevação Lateral", "Ombros", 60, 0);
        ex2.addSet(new WorkoutSet(BigDecimal.valueOf(14), 10, BigDecimal.valueOf(9), null, null, 0));
        w2.addExercise(ex2);

        Workout w3 = new Workout(null, "w-3", "Treino Ombro", "2026-10-15", null, BigDecimal.ZERO);
        Exercise ex3 = new Exercise("Elevação Lateral", "Ombros", 60, 0);
        ex3.addSet(new WorkoutSet(BigDecimal.valueOf(14), 10, BigDecimal.valueOf(9.5), null, null, 0));
        w3.addExercise(ex3);

        List<PlateauExerciseDto> plateaus = mathEngine.detectPlateaus(List.of(w1, w2, w3));

        assertThat(plateaus).hasSize(1);
        PlateauExerciseDto p = plateaus.get(0);
        assertThat(p.exerciseName()).isEqualTo("Elevação Lateral");
        assertThat(p.routineTitle()).isEqualTo("Treino Ombro");
        assertThat(p.consecutiveStagnantSessions()).isEqualTo(3);
        assertThat(p.suggestedAction()).isNotBlank();
    }

    @Test
    @DisplayName("calculateAcwr deve calcular o ratio agudo/crônico e classificar em Sweet Spot ou Zona de Perigo")
    void testCalculateAcwr() {
        String today = LocalDate.now().toString();
        String day3 = LocalDate.now().minusDays(3).toString();
        String day10 = LocalDate.now().minusDays(10).toString();
        String day17 = LocalDate.now().minusDays(17).toString();
        String day24 = LocalDate.now().minusDays(24).toString();

        Workout w1 = new Workout(null, "w-1", "Treino A", today, null, BigDecimal.valueOf(1000));
        Workout w2 = new Workout(null, "w-2", "Treino B", day10, null, BigDecimal.valueOf(1000));
        Workout w3 = new Workout(null, "w-3", "Treino C", day17, null, BigDecimal.valueOf(1000));
        Workout w4 = new Workout(null, "w-4", "Treino D", day24, null, BigDecimal.valueOf(1000));

        ProgressionMathEngine.AcwrAnalysis sweetSpot = mathEngine.calculateAcwr(List.of(w1, w2, w3, w4));
        assertThat(sweetSpot.riskLevel()).isEqualTo(ProgressionMathEngine.AcwrRiskLevel.OPTIMAL);
        assertThat(sweetSpot.ratio()).isEqualTo(1.0);
        assertThat(sweetSpot.acuteVolumeKg()).isEqualTo(1000.0);
        assertThat(sweetSpot.chronicWeeklyVolumeKg()).isEqualTo(1000.0);

        Workout wSpike = new Workout(null, "w-spike", "Treino Extra", day3, null, BigDecimal.valueOf(1200));
        ProgressionMathEngine.AcwrAnalysis dangerZone = mathEngine.calculateAcwr(List.of(w1, wSpike, w2, w3, w4));
        assertThat(dangerZone.riskLevel()).isEqualTo(ProgressionMathEngine.AcwrRiskLevel.DANGER_ZONE);
        assertThat(dangerZone.ratio()).isGreaterThanOrEqualTo(1.5);
        assertThat(dangerZone.recommendation()).contains("deload");
    }

    @Test
    @DisplayName("calculateProgressionTrajectory deve computar evolução longitudinal do 1RM")
    void testCalculateProgressionTrajectory() {
        Workout w1 = new Workout(null, "w-1", "Treino A", "2026-09-01", null, BigDecimal.ZERO);
        Exercise ex1 = new Exercise("Agachamento Livre", "Pernas", 120, 0);
        ex1.addSet(new WorkoutSet(BigDecimal.valueOf(100), 5, BigDecimal.valueOf(8), null, null, 0));
        w1.addExercise(ex1);

        Workout w2 = new Workout(null, "w-2", "Treino A", "2026-09-15", null, BigDecimal.ZERO);
        Exercise ex2 = new Exercise("Agachamento Livre", "Pernas", 120, 0);
        ex2.addSet(new WorkoutSet(BigDecimal.valueOf(110), 5, BigDecimal.valueOf(8.5), null, null, 0));
        w2.addExercise(ex2);

        ProgressionMathEngine.ExerciseProgressionTrajectory trajectory =
                mathEngine.calculateProgressionTrajectory(List.of(w1, w2), "Agachamento Livre");

        assertThat(trajectory.historical1Rms()).hasSize(2);
        assertThat(trajectory.latest1Rm()).isGreaterThan(trajectory.initial1Rm());
        assertThat(trajectory.totalGainKg()).isGreaterThan(10.0);
        assertThat(trajectory.totalGainPercent()).isGreaterThan(8.0);
    }
}
