package com.focuslift.domain.model;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exercises")
public class Exercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_id", nullable = false)
    private Workout workout;

    @Column(nullable = false)
    private String name;

    @Column(name = "muscle_group", length = 100)
    private String muscleGroup;

    @Column(name = "rest_timer_seconds")
    private Integer restTimerSeconds = 90;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    @BatchSize(size = 100)
    @OneToMany(mappedBy = "exercise", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("orderIndex ASC")
    private List<WorkoutSet> sets = new ArrayList<>();

    public Exercise() {}

    public Exercise(String name, String muscleGroup, Integer restTimerSeconds, Integer orderIndex) {
        this.name = name;
        this.muscleGroup = muscleGroup;
        this.restTimerSeconds = restTimerSeconds != null ? restTimerSeconds : 90;
        this.orderIndex = orderIndex != null ? orderIndex : 0;
    }

    public void addSet(WorkoutSet set) {
        sets.add(set);
        set.setExercise(this);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Workout getWorkout() { return workout; }
    public void setWorkout(Workout workout) { this.workout = workout; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getMuscleGroup() { return muscleGroup; }
    public void setMuscleGroup(String muscleGroup) { this.muscleGroup = muscleGroup; }

    public Integer getRestTimerSeconds() { return restTimerSeconds; }
    public void setRestTimerSeconds(Integer restTimerSeconds) { this.restTimerSeconds = restTimerSeconds; }

    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }

    public List<WorkoutSet> getSets() { return sets; }
    public void setSets(List<WorkoutSet> sets) { this.sets = sets; }
}
