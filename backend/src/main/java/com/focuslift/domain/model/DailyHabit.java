package com.focuslift.domain.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "daily_habits")
public class DailyHabit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String date;

    @Column(name = "protein_done")
    private Integer proteinDone = 0;

    @Column(name = "water_done")
    private Integer waterDone = 0;

    @Column(name = "workout_done")
    private Integer workoutDone = 0;

    @Column(name = "meals_done")
    private Integer mealsDone = 0;

    @Column(name = "streak_count")
    private Integer streakCount = 0;

    @Column(name = "water_current_ml")
    private Integer waterCurrentMl = 0;

    @Column(name = "water_target_ml")
    private Integer waterTargetMl = 3000;

    @Column(name = "protein_current_g")
    private Integer proteinCurrentG = 0;

    @Column(name = "protein_target_g")
    private Integer proteinTargetG = 160;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    public DailyHabit() {}

    public DailyHabit(User user, String date) {
        this.user = user;
        this.date = date;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Integer getProteinDone() { return proteinDone; }
    public void setProteinDone(Integer proteinDone) { this.proteinDone = proteinDone; }

    public Integer getWaterDone() { return waterDone; }
    public void setWaterDone(Integer waterDone) { this.waterDone = waterDone; }

    public Integer getWorkoutDone() { return workoutDone; }
    public void setWorkoutDone(Integer workoutDone) { this.workoutDone = workoutDone; }

    public Integer getMealsDone() { return mealsDone; }
    public void setMealsDone(Integer mealsDone) { this.mealsDone = mealsDone; }

    public Integer getStreakCount() { return streakCount; }
    public void setStreakCount(Integer streakCount) { this.streakCount = streakCount; }

    public Integer getWaterCurrentMl() { return waterCurrentMl; }
    public void setWaterCurrentMl(Integer waterCurrentMl) { this.waterCurrentMl = waterCurrentMl; }

    public Integer getWaterTargetMl() { return waterTargetMl; }
    public void setWaterTargetMl(Integer waterTargetMl) { this.waterTargetMl = waterTargetMl; }

    public Integer getProteinCurrentG() { return proteinCurrentG; }
    public void setProteinCurrentG(Integer proteinCurrentG) { this.proteinCurrentG = proteinCurrentG; }

    public Integer getProteinTargetG() { return proteinTargetG; }
    public void setProteinTargetG(Integer proteinTargetG) { this.proteinTargetG = proteinTargetG; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
