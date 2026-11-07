package com.focuslift.domain.model;

import com.focuslift.domain.enums.SetType;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "workout_sets")
public class WorkoutSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal weight;

    @Column(nullable = false)
    private Integer reps;

    @Column(precision = 3, scale = 1)
    private BigDecimal rpe;

    @Enumerated(EnumType.STRING)
    @Column(name = "set_type", nullable = false, length = 50)
    private SetType setType = SetType.NORMAL;

    @Column(name = "completed_at", length = 50)
    private String completedAt;

    @Column(name = "order_index")
    private Integer orderIndex = 0;

    public WorkoutSet() {}

    public WorkoutSet(BigDecimal weight, Integer reps, BigDecimal rpe, SetType setType, String completedAt, Integer orderIndex) {
        this.weight = weight != null ? weight : BigDecimal.ZERO;
        this.reps = reps != null ? reps : 0;
        this.rpe = rpe;
        this.setType = setType != null ? setType : SetType.NORMAL;
        this.completedAt = completedAt;
        this.orderIndex = orderIndex != null ? orderIndex : 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Exercise getExercise() { return exercise; }
    public void setExercise(Exercise exercise) { this.exercise = exercise; }

    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }

    public Integer getReps() { return reps; }
    public void setReps(Integer reps) { this.reps = reps; }

    public BigDecimal getRpe() { return rpe; }
    public void setRpe(BigDecimal rpe) { this.rpe = rpe; }

    public SetType getSetType() { return setType; }
    public void setSetType(SetType setType) { this.setType = setType; }

    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }

    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
}
