'use strict';
var learnjs = {
  region: 'ap-northeast-1',
  IdentityPoolId: 'ap-northeast-1:832c49ef-f09c-4385-bcf1-e4aa72aeec3d',
  UserPoolId: 'ap-northeast-1_9P7D4UaFm',
  ClientId: '3vhqikvlcs8p17qaoeriiq9luc',
  LoginsKey: 'cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_9P7D4UaFm'
};

learnjs.UserPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool({
  UserPoolId: learnjs.UserPoolId,
  ClientId: learnjs.ClientId
});
  
learnjs.landingView = function() {
    return learnjs.template('landing-view');
}

learnjs.problemView = function(data) {
  var problemNumber = parseInt(data, 10);
  var view = $('.templates .problem-view').clone();
  var problemData = learnjs.problems[problemNumber - 1];
  var resultFlash = view.find('.result');

  function checkAnswer() {
    var answer = view.find('.answer').val();
    var test =  problemData.code.replace('__', answer) + '; problem();';
    return eval(test);
  }

  function checkAnswerClick() {
    if (checkAnswer()) {
      learnjs.flashElement(resultFlash, learnjs.buildCorrectFlash(problemNumber));
    } else {
      learnjs.flashElement(resultFlash, 'Incorrect!');
    }
    return false;
  }

  view.find('.check-btn').click(checkAnswerClick);
  view.find('.title').text('Problem #' + problemNumber);
  learnjs.applyObject(problemData, view);
  if(problemNumber < learnjs.problems.length) {
    var buttonItem = learnjs.template('skip-btn');
    buttonItem.find('a').attr('href', '#problem-' + (problemNumber + 1));
    $('.nav-list').append(buttonItem);
    view.bind('removingView', function() {
      buttonItem.remove();
    });
  }
  return view;
}

learnjs.buildCorrectFlash = function(problemNumber) {
  var correctFlash = learnjs.template('correct-flash');
  var link = correctFlash.find('a');
  if (problemNumber < learnjs.problems.length) {
    link.attr('href', '#problem-' + (problemNumber + 1));
  } else {
    link.attr('href', '');
    link.text("You're Finished!");
  }
  return correctFlash;
}

learnjs.signinView = function() {

  function cognitoSignin() {
    var username = $('.username').val();
    var password = $('.password').val();
    if (!username || !password) { return false; }

    learnjs.Signout();

    learnjs.cognitoAuthConfig = {
      onSuccess: function(result) {
        view.find('.message').text('SignIn Success.');
        
        AWS.config.region = learnjs.region;
        var logins = {};
        logins[learnjs.LoginsKey] = result.getIdToken().getJwtToken();
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
          IdentityPoolId: learnjs.IdentityPoolId,
          Logins: logins
        });
        learnjs.awsRefresh().then(
          function() {
            learnjs.identity.notify({
              username: learnjs.UserPool.getCurrentUser().username,
            });
            $(location).attr('href', '#');
          },
          function(err) {
            console.log(err);
            learnjs.identity.notify();
          }
        );
      },
 
      onFailure: function(err) {
        view.find('.message').text(err.message);
      },

      newPasswordRequired(userAttributes, requiredAttributes) {
        switchElement('.enter-new-cognito-password');
        view.find('.message').text('New Password Required');
      },
    };

    learnjs.cognitoSignin(username, password);
    return false;
  }

  function setCognitoPassword() {
    var newPassword = $('.new-password').val();
    if(!newPassword) { return false; }
    if(learnjs.cognitoUser && learnjs.cognitoAuthConfig){
      learnjs.cognitoUser.completeNewPasswordChallenge(newPassword, {}, learnjs.cognitoAuthConfig);
    }
    return false;
  }

  function switchElement(elem) {
    var elements = [
       '.enter-cognito-signin',
       '.enter-new-cognito-password'
    ];
    for( var e of elements) {
      if(e==elem) {
        view.find(e).css('display','');
      } else {
        view.find(e).css('display','none');
      }
    }
  }

  var view=learnjs.template('signin-view');
  switchElement('.enter-cognito-signin');
  view.find('.cognito-signin-btn').click(cognitoSignin);
  view.find('.set-cognito-password-btn').click(setCognitoPassword);
  return view;
}

learnjs.cognitoAuthConfig = null;
learnjs.cognitoUser = null;

learnjs.cognitoSignin = function(username, password) {
  var authenticationData = {
    Username: username,
    Password: password
  };
  var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);
  var userData = {
    Username: username,
    Pool: learnjs.UserPool
  };
  learnjs.cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
  learnjs.cognitoUser.authenticateUser(authenticationDetails, learnjs.cognitoAuthConfig);
}

learnjs.identity = new $.Deferred();

learnjs.Signout = function() {
  if(learnjs.UserPool.getCurrentUser() != null) {
    learnjs.UserPool.getCurrentUser().signOut();
  }
  learnjs.identity.notify();
}

learnjs.awsRefresh = function() {
  var deferred = new $.Deferred();
  AWS.config.credentials.clearCachedId();
  AWS.config.credentials.refresh(function(err) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve();
    }
  });
  return deferred.promise();
}

learnjs.profileView = function() {
  var view=learnjs.template('profile-view');
  learnjs.identity.progress(function(identity) {
    if(identity){
      view.find('.profile-detail').css('display','');
      view.find('.message').text('');
      view.find('.username').text(identity.username);
    } else {
      view.find('.profile-detail').css('display','none');
      view.find('.message').text('No SignIn');
    }
  });
  view.find('.signout-btn').click(learnjs.Signout);
  return view;
}

learnjs.showView = function(hash) {
  var routes = {
    '#problem':learnjs.problemView,
    '#signin':learnjs.signinView,
    '#profile':learnjs.profileView,
    '#':learnjs.landingView,
    '':learnjs.landingView
  };
  var hashParts = hash.split('-');
  var viewFn = routes[hashParts[0]];
  if (viewFn) {
    learnjs.triggerEvent('removingView', [])
    $('.view-container').empty().append(viewFn(hashParts[1]));
  }
}

learnjs.triggerEvent = function(name, args) {
  $('.view-container>*').trigger(name, args);
}

learnjs.appOnReady = function(hash) {
  window.onhashchange = function() {
    learnjs.showView(window.location.hash);
  }
  learnjs.showView(window.location.hash);
  learnjs.identity.progress(function(identity) {
    if(identity){
      $('.signin-bar').find('.profile-link').text(identity.username);
    } else {
      $('.signin-bar').find('.profile-link').text('');
    }
  });
  if(learnjs.UserPool.getCurrentUser()) {
    learnjs.identity.notify({
      username: learnjs.UserPool.getCurrentUser().username,
    });
  } else {
    learnjs.identity.notify();
  }
}

learnjs.applyObject = function(obj, elem) {
  for (var key in obj) {
    elem.find('[data-name="' + key + '"]').text(obj[key]);
  }
};

learnjs.flashElement = function(elem, content) {
  elem.fadeOut('fast', function() {
    elem.html(content);
    elem.fadeIn();
  });
}

learnjs.template = function(name) {
  return $('.templates .' + name).clone();
}

learnjs.problems = [
  {
    description: "What is truth?",
    code: "function problem() { return __; }"
  }
  ,{
    description: "Simple Math",
    code: "function problem() { return 42 === 6 * __; }"
  }
  ,{
    description: "Simple Math",
    code: "function problem() { return 60 === 3 * __; }"
  }
];
