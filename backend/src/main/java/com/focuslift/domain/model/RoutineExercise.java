package com.focuslift.domain.model;

import jakarta.persistence.*;

@Entity
@Table(name = "routine_exercises")
public class RoutineExercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "routine_id", nullable = false)
    private Routine routine;

    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @Column(name = "muscle_group", length = 100)
    private String muscleGroup;

    @Column(name = "target_sets")
    private Integer targetSets = 3;

    @Column(name = "rest_timer_seconds")
    private Integer restTimerSeconds = 90;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    public RoutineExercise() {}

    public RoutineExercise(String exerciseName, String muscleGroup, Integer targetSets, Integer restTimerSeconds, Integer orderIndex) {
        this.exerciseName = exerciseName;
        this.muscleGroup = muscleGroup;
        this.targetSets = targetSets != null ? targetSets : 3;
        this.restTimerSeconds = restTimerSeconds != null ? restTimerSeconds : 90;
        this.orderIndex = orderIndex != null ? orderIndex : 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Routine getRoutine() { return routine; }
    public void setRoutine(Routine routine) { this.routine = routine; }

    public String getExerciseName() { return exerciseName; }
    public void setExerciseName(String exerciseName) { this.exerciseName = exerciseName; }

    public String getMuscleGroup() { return muscleGroup; }
    public void setMuscleGroup(String muscleGroup) { this.muscleGroup = muscleGroup; }

    public Integer getTargetSets() { return targetSets; }
    public void setTargetSets(Integer targetSets) { this.targetSets = targetSets; }

    public Integer getRestTimerSeconds() { return restTimerSeconds; }
    public void setRestTimerSeconds(Integer restTimerSeconds) { this.restTimerSeconds = restTimerSeconds; }

    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
}
