package linear

const queryViewer = `query { viewer { id name email } }`

const queryTeams = `query { teams { nodes { id name key } } }`

const queryActiveCycle = `query($teamId: String!) {
  team(id: $teamId) {
    activeCycle {
      id
      name
      number
      startsAt
      endsAt
      issues(first: 250) {
        nodes {
          id
          identifier
          title
          description
          priority
          url
          createdAt
          updatedAt
          state {
            id
            name
            color
            type
          }
          assignee {
            id
            name
            email
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
        }
      }
    }
  }
}`

const queryTeamStates = `query($teamId: String!) {
  team(id: $teamId) {
    states {
      nodes {
        id
        name
        color
        type
      }
    }
  }
}`

const queryIssue = `query($id: String!) {
  issue(id: $id) {
    id
    identifier
    title
    description
    priority
    url
    createdAt
    updatedAt
    state {
      id
      name
      color
      type
    }
    assignee {
      id
      name
      email
    }
    labels {
      nodes {
        id
        name
        color
      }
    }
  }
}`

const queryMyIssues = `query {
  viewer {
    assignedIssues(
      first: 250
      orderBy: updatedAt
    ) {
      nodes {
        id
        identifier
        title
        description
        priority
        url
        createdAt
        updatedAt
        state {
          id
          name
          color
          type
        }
        assignee {
          id
          name
          email
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        team {
          id
          name
          key
        }
      }
    }
  }
}`

const mutationUpdateIssueState = `mutation($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) {
    success
    issue {
      id
      state {
        id
        name
        type
      }
    }
  }
}`
