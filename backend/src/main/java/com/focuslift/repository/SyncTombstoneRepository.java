package com.focuslift.repository;

import com.focuslift.domain.model.SyncTombstone;
import com.focuslift.domain.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SyncTombstoneRepository extends JpaRepository<SyncTombstone, Long> {
    List<SyncTombstone> findByUser(User user);
    Optional<SyncTombstone> findByUserAndEntityTypeAndClientUuid(User user, String entityType, String clientUuid);
}
