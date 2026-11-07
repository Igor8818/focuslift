package com.focuslift.domain.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sync_tombstones")
public class SyncTombstone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "entity_type", nullable = false, length = 50)
    private String entityType;

    @Column(name = "client_uuid", nullable = false, length = 100)
    private String clientUuid;

    @Column(name = "deleted_at")
    private Instant deletedAt = Instant.now();

    public SyncTombstone() {}

    public SyncTombstone(User user, String entityType, String clientUuid) {
        this.user = user;
        this.entityType = entityType;
        this.clientUuid = clientUuid;
        this.deletedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getClientUuid() { return clientUuid; }
    public void setClientUuid(String clientUuid) { this.clientUuid = clientUuid; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
