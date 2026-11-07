package com.focuslift.service;

import com.focuslift.domain.enums.SetType;
import com.focuslift.domain.model.*;
import com.focuslift.dto.sync.*;
import com.focuslift.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class SyncService {

    private final WorkoutRepository workoutRepository;
    private final RoutineRepository routineRepository;
    private final DailyHabitRepository dailyHabitRepository;
    private final SyncTombstoneRepository tombstoneRepository;

    public SyncService(
            WorkoutRepository workoutRepository,
            RoutineRepository routineRepository,
            DailyHabitRepository dailyHabitRepository,
            SyncTombstoneRepository tombstoneRepository
    ) {
        this.workoutRepository = workoutRepository;
        this.routineRepository = routineRepository;
        this.dailyHabitRepository = dailyHabitRepository;
        this.tombstoneRepository = tombstoneRepository;
    }

    @Transactional
    public SyncPushResponse pushSync(User user, SyncPushRequest request) {
        int workoutsSaved = 0;
        int routinesSaved = 0;
        int habitsSaved = 0;
        int tombstonesProcessed = 0;

        // 1. Processar exclusões (Tombstones) primeiro para manter a integridade
        if (request.tombstones() != null) {
            for (TombstoneSyncDto t : request.tombstones()) {
                if (t.clientUuid() == null || t.clientUuid().isBlank()) continue;
                String entityType = t.entityType() != null ? t.entityType().toLowerCase().trim() : "";

                if ("workout".equals(entityType)) {
                    Optional<Workout> found = workoutRepository.findByUserAndClientUuid(user, t.clientUuid());
                    if (found.isEmpty()) {
                        String alt = t.clientUuid().startsWith("workout-local-")
                                ? t.clientUuid().substring("workout-local-".length())
                                : "workout-local-" + t.clientUuid();
                        found = workoutRepository.findByUserAndClientUuid(user, alt);
                    }
                    found.ifPresent(workoutRepository::delete);
                } else if ("routine".equals(entityType)) {
                    Optional<Routine> found = routineRepository.findByUserAndClientUuid(user, t.clientUuid());
                    if (found.isEmpty()) {
                        String alt = t.clientUuid().startsWith("routine-local-")
                                ? t.clientUuid().substring("routine-local-".length())
                                : "routine-local-" + t.clientUuid();
                        found = routineRepository.findByUserAndClientUuid(user, alt);
                    }
                    found.ifPresent(routineRepository::delete);
                }

                if (tombstoneRepository.findByUserAndEntityTypeAndClientUuid(user, entityType, t.clientUuid()).isEmpty()) {
                    tombstoneRepository.save(new SyncTombstone(user, entityType, t.clientUuid()));
                }
                tombstonesProcessed++;
            }
        }

        // 2. Processar Fichas (Routines)
        if (request.routines() != null) {
            for (RoutineSyncDto rDto : request.routines()) {
                if (rDto.name() == null || rDto.name().isBlank()) continue;
                String clientUuid = rDto.clientUuid() != null ? rDto.clientUuid() : ("routine-" + rDto.id());

                Routine routine = routineRepository.findByUserAndClientUuid(user, clientUuid)
                        .orElseGet(() -> new Routine(user, clientUuid, rDto.name(), rDto.description(), rDto.color()));

                routine.setName(rDto.name());
                routine.setDescription(rDto.description());
                routine.setColor(rDto.color());
                routine.clearExercises();

                if (rDto.exercises() != null) {
                    for (int i = 0; i < rDto.exercises().size(); i++) {
                        RoutineExerciseSyncDto reDto = rDto.exercises().get(i);
                        RoutineExercise re = new RoutineExercise(
                                reDto.exerciseName(),
                                reDto.muscleGroup(),
                                reDto.targetSets(),
                                reDto.restTimerSeconds(),
                                reDto.orderIndex() != null ? reDto.orderIndex() : i
                        );
                        routine.addExercise(re);
                    }
                }
                routineRepository.save(routine);
                routinesSaved++;
            }
        }

        // 3. Processar Treinos (Workouts)
        if (request.workouts() != null) {
            for (WorkoutSyncDto wDto : request.workouts()) {
                if (wDto.title() == null || wDto.title().isBlank()) continue;
                String clientUuid = wDto.clientUuid() != null ? wDto.clientUuid() : ("workout-" + wDto.id());

                Workout workout = workoutRepository.findByUserAndClientUuid(user, clientUuid)
                        .orElseGet(() -> new Workout(user, clientUuid, wDto.title(), wDto.date(), wDto.notes(), wDto.totalVolumeKg()));

                workout.setTitle(wDto.title());
                workout.setDate(wDto.date() != null ? wDto.date() : "");
                workout.setNotes(wDto.notes());
                workout.clearExercises();

                BigDecimal totalVol = BigDecimal.ZERO;

                if (wDto.exercises() != null) {
                    for (int exIdx = 0; exIdx < wDto.exercises().size(); exIdx++) {
                        ExerciseSyncDto exDto = wDto.exercises().get(exIdx);
                        Exercise ex = new Exercise(
                                exDto.name(),
                                exDto.muscleGroup(),
                                exDto.restTimerSeconds(),
                                exDto.orderIndex() != null ? exDto.orderIndex() : exIdx
                        );

                        if (exDto.sets() != null) {
                            for (int sIdx = 0; sIdx < exDto.sets().size(); sIdx++) {
                                SetSyncDto sDto = exDto.sets().get(sIdx);
                                BigDecimal w = sDto.weight() != null ? sDto.weight() : BigDecimal.ZERO;
                                int reps = sDto.reps() != null ? sDto.reps() : 0;
                                totalVol = totalVol.add(w.multiply(BigDecimal.valueOf(reps)));

                                WorkoutSet set = new WorkoutSet(
                                        w,
                                        reps,
                                        sDto.rpe(),
                                        SetType.fromString(sDto.setType()),
                                        sDto.completedAt(),
                                        sDto.orderIndex() != null ? sDto.orderIndex() : sIdx
                                );
                                ex.addSet(set);
                            }
                        }
                        workout.addExercise(ex);
                    }
                }

                workout.setTotalVolumeKg(wDto.totalVolumeKg() != null && wDto.totalVolumeKg().compareTo(BigDecimal.ZERO) > 0
                        ? wDto.totalVolumeKg()
                        : totalVol);

                workoutRepository.save(workout);
                workoutsSaved++;
            }
        }

        // 4. Processar Hábitos Diários
        if (request.habits() != null) {
            for (HabitSyncDto hDto : request.habits()) {
                if (hDto.date() == null || hDto.date().isBlank()) continue;

                DailyHabit habit = dailyHabitRepository.findByUserAndDate(user, hDto.date())
                        .orElseGet(() -> new DailyHabit(user, hDto.date()));

                habit.setProteinDone(hDto.proteinDone() != null ? hDto.proteinDone() : 0);
                habit.setWaterDone(hDto.waterDone() != null ? hDto.waterDone() : 0);
                habit.setWorkoutDone(hDto.workoutDone() != null ? hDto.workoutDone() : 0);
                habit.setMealsDone(hDto.mealsDone() != null ? hDto.mealsDone() : 0);
                habit.setStreakCount(hDto.streakCount() != null ? hDto.streakCount() : 0);
                habit.setWaterCurrentMl(hDto.waterCurrentMl() != null ? hDto.waterCurrentMl() : 0);
                habit.setWaterTargetMl(hDto.waterTargetMl() != null ? hDto.waterTargetMl() : 3000);
                habit.setProteinCurrentG(hDto.proteinCurrentG() != null ? hDto.proteinCurrentG() : 0);
                habit.setProteinTargetG(hDto.proteinTargetG() != null ? hDto.proteinTargetG() : 160);

                dailyHabitRepository.save(habit);
                habitsSaved++;
            }
        }

        return new SyncPushResponse(
                true,
                workoutsSaved,
                routinesSaved,
                habitsSaved,
                tombstonesProcessed,
                Instant.now().toString()
        );
    }

    @Transactional(readOnly = true)
    public SyncPullResponse pullSync(User user) {
        List<Workout> workouts = workoutRepository.findAllWorkoutsWithDetails(user);
        List<Routine> routines = routineRepository.findAllWithExercises(user);
        List<DailyHabit> habits = dailyHabitRepository.findByUserOrderByDateDesc(user);

        List<WorkoutSyncDto> workoutDtos = workouts.stream().map(this::toWorkoutDto).toList();
        List<RoutineSyncDto> routineDtos = routines.stream().map(this::toRoutineDto).toList();
        List<HabitSyncDto> habitDtos = habits.stream().map(this::toHabitDto).toList();

        return new SyncPullResponse(workoutDtos, routineDtos, habitDtos, Instant.now().toString());
    }

    private WorkoutSyncDto toWorkoutDto(Workout w) {
        List<ExerciseSyncDto> exerciseDtos = new ArrayList<>();
        if (w.getExercises() != null) {
            for (Exercise ex : w.getExercises()) {
                List<SetSyncDto> setDtos = new ArrayList<>();
                if (ex.getSets() != null) {
                    for (WorkoutSet s : ex.getSets()) {
                        setDtos.add(new SetSyncDto(
                                s.getId(),
                                s.getWeight(),
                                s.getReps(),
                                s.getRpe(),
                                s.getSetType().name().toLowerCase(),
                                s.getCompletedAt(),
                                s.getOrderIndex()
                        ));
                    }
                }
                exerciseDtos.add(new ExerciseSyncDto(
                        ex.getId(),
                        ex.getName(),
                        ex.getMuscleGroup(),
                        ex.getRestTimerSeconds(),
                        ex.getOrderIndex(),
                        setDtos
                ));
            }
        }
        return new WorkoutSyncDto(
                w.getId(),
                w.getClientUuid(),
                w.getTitle(),
                w.getDate(),
                w.getNotes(),
                w.getTotalVolumeKg(),
                exerciseDtos,
                w.getCreatedAt().toString()
        );
    }

    private RoutineSyncDto toRoutineDto(Routine r) {
        List<RoutineExerciseSyncDto> exerciseDtos = new ArrayList<>();
        if (r.getExercises() != null) {
            for (RoutineExercise ex : r.getExercises()) {
                exerciseDtos.add(new RoutineExerciseSyncDto(
                        ex.getId(),
                        ex.getExerciseName(),
                        ex.getMuscleGroup(),
                        ex.getTargetSets(),
                        ex.getRestTimerSeconds(),
                        ex.getOrderIndex()
                ));
            }
        }
        return new RoutineSyncDto(
                r.getId(),
                r.getClientUuid(),
                r.getName(),
                r.getDescription(),
                r.getColor(),
                exerciseDtos,
                r.getCreatedAt().toString()
        );
    }

    private HabitSyncDto toHabitDto(DailyHabit h) {
        return new HabitSyncDto(
                h.getId(),
                h.getDate(),
                h.getProteinDone(),
                h.getWaterDone(),
                h.getWorkoutDone(),
                h.getMealsDone(),
                h.getStreakCount(),
                h.getWaterCurrentMl(),
                h.getWaterTargetMl(),
                h.getProteinCurrentG(),
                h.getProteinTargetG()
        );
    }
}
