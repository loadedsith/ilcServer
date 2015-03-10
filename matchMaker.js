console = require('better-console');

var matchMaker = {};
matchMaker.matchList = {};
matchMaker.isBlacklisted = function(interest, blacklist) {
  'use strict';
  for (var i = blacklist.length - 1; i >= 0; i--) {
    if (interest === blacklist[i]) {
      return true;
    }
  }
  return false;
};

matchMaker.populateMatchList = function(inUser, usersSnapshot) {
  'use strict';
  // inUser is the user for whom the match list is being created

  if ((inUser.profile || {}).interests === undefined) {
    //if the in user has no interests so, no matches
    return;
  }

  //For every user
  usersSnapshot.forEach(function(userRef) {
    var user = userRef.val();
    var userId = user.id || user.data['user_id'];

    //for every inUser interest
    for (var ti = inUser.profile.interests.length - 1; ti >= 0; ti--) {
      var interest = inUser.profile.interests[ti];

      //Skip yourself son
      if (String(inUser.data['user_id']) !== String(userId)) {

        //check if the user is blacklisted, it wont matter for which categories if its already blacklisted;
        var blacklisted = matchMaker.isBlacklisted(interest, (inUser.profile.blacklist || []));
        if (!blacklisted) {

          if (((user.profile || {}).interests || []).indexOf(interest) !== -1) {

            //hide the others rooms from the match list results, for privacy conserns
            delete inUser.profile.rooms;

            //create a minimal profile from user
            var profile = {
              id: String(userId),
              profile: (user.profile || null)
            };

            //match maker topic creation
            if (matchMaker.matchList[interest] === undefined) {
              matchMaker.matchList[interest] = [
                profile
              ];
            } else {
              matchMaker.matchList[interest].push(profile);
            }
          }
        }
      }
    }//end inUser interests

    //if the inUser is not the interest-user
    var isInUser = String(inUser.id) !== String(userId);
    if (isInUser && inUser.includeNoMatches === true) {
      var match = {
        id:String(user.id || user.data['user_id']),
        profile:(user.profile || null)
      };
      if (matchMaker.matchList['no-topic'] === undefined) {
        matchMaker.matchList['no-topic'] = [match];
      } else {
        matchMaker.matchList['no-topic'].push(match);
      }
    }
  });
};
matchMaker.blacklistMatchList = function(user) {
  'use strict';
  var topics = (user.topics || ['debug topics']);
  var blacklist = (user.blacklist || ['debug blacklist']);
  for (var ti = topics.length - 1; ti >= 0; ti--) {
    var topic = topics[ti];
    //start with all the user's topics
    var matchesForTopic = matchMaker.matchList[topic];
    //if there are any results for this topic
    if (matchesForTopic !== undefined) {
      //go through the black list
      for (var bi = blacklist.length - 1; bi >= 0; bi--) {
        var blacklisted = blacklist[bi];
        //a flag to remove the topic if needed
        var itIsBlacklisted = false;
        for (var i = matchesForTopic.length - 1; i >= 0; i--) {
          var matchForTopic = matchesForTopic[i];
          if(String(user.id) === String(matchForTopic)){
            itIsBlacklisted = true;
          }
          //go through the matched topic's user ids
          if (String(blacklisted) === String(matchForTopic)) {
            //flag this matchForTopic for removal
            itIsBlacklisted = true;
          }
        }
        //now that we arent looping over the topics,
        // check if the current blacklist object should be removed from the matches
        if (itIsBlacklisted === true) {
          // remove blacklist object from match topic
          matchesForTopic.pop(blacklisted);
        }
      }
    }
  }
};

matchMaker.getMatchList = function(user, usersSnapshot) {
  'use strict';
  matchMaker.matchList = {};
  matchMaker.populateMatchList(user, usersSnapshot);
  matchMaker.blacklistMatchList(user, usersSnapshot);
  return matchMaker.matchList;
};


module.exports=matchMaker;